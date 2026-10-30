import { describe, it, expect } from 'vitest';
import { themes, freeThemeIds } from '../src/content/themes';
import { levels } from '../src/content/levels';
import { GameStore, decodeSave, defaultSave } from '../src/services/save';

const memory = () => { let raw: string | null = null; return { getItem: () => raw, setItem: (_k: string, v: string) => { raw = v; } }; };

describe('theme ownership and purchases', () => {
  it('migrates pre-catalog saves with two free themes and preserves valuable state', () => {
    const old: Record<string, unknown> = { ...defaultSave(), version: 1, coins: 720, path: [0, 1] };
    delete old.themeId; delete old.ownedThemes;
    expect(decodeSave(JSON.stringify(old))).toMatchObject({ coins: 720, path: [0, 1], themeId: 'classic', ownedThemes: freeThemeIds });
  });
  it('does not mistake missing paid-ownership fields in a v2 save for a legacy save', () => {
    const damaged: Record<string, unknown> = { ...defaultSave(), coins: 200 };
    delete damaged.themeId; delete damaged.ownedThemes;
    expect(() => decodeSave(JSON.stringify(damaged))).toThrow('theme ownership');
  });
  it('equips a free theme without spending coins or altering the route', () => {
    const store = new GameStore(memory()); store.path(levels[0]!, [0, 1]);
    expect(store.selectTheme('mint')).toBe('equipped');
    expect(store.state).toMatchObject({ coins: 0, themeId: 'mint', path: [0, 1], hints: 3, completed: [] });
  });
  it('commits coins, ownership and equipment together and never charges twice', () => {
    const storage = memory(), store = new GameStore(storage); store.write({ ...store.state, coins: 500 });
    expect(store.selectTheme('lagoon')).toBe('purchased');
    expect(new GameStore(storage).state).toMatchObject({ coins: 0, themeId: 'lagoon', ownedThemes: ['classic', 'mint', 'lagoon'] });
    expect(store.selectTheme('lagoon')).toBe('unchanged'); store.selectTheme('classic');
    expect(new GameStore(storage).selectTheme('lagoon')).toBe('equipped');
    expect(new GameStore(storage).state.coins).toBe(0);
  });
  it('does not write or partially unlock with insufficient balance', () => {
    const storage = memory(), store = new GameStore(storage); store.write({ ...store.state, coins: 499 });
    const raw = storage.getItem(); expect(store.selectTheme('dusk')).toBe('insufficient');
    expect(storage.getItem()).toBe(raw); expect(store.state.ownedThemes).not.toContain('dusk');
  });
  it('rejects unknown, duplicated, incomplete or unowned equipped state without resetting coins', () => {
    for (const patch of [{ themeId: 'missing' }, { themeId: 'dusk' }, { ownedThemes: ['classic', 'mint', 'bad'] }, { ownedThemes: ['classic', 'classic', 'mint'] }, { ownedThemes: null }, { themeId: undefined }]) {
      expect(() => decodeSave(JSON.stringify({ ...defaultSave(), coins: 900, ...patch }))).toThrow();
    }
    const store = new GameStore(memory()); expect(() => store.selectTheme('unknown')).toThrow();
  });
  it('does not publish ownership or debit memory after a failed purchase write', () => {
    const backing = memory(); const seed = new GameStore(backing); seed.write({ ...seed.state, coins: 500 });
    const store = new GameStore({ getItem: backing.getItem, setItem: () => { throw Error('disk full'); } });
    expect(() => store.selectTheme('dusk')).toThrow();
    expect(store.state).toMatchObject({ coins: 500, themeId: 'classic', ownedThemes: freeThemeIds });
    expect(new GameStore(backing).state.coins).toBe(500); expect(store.recoveryRequired).toBe(true);
  });
  it('verifies a persisted write after a lost ack, then reload/retry does not debit again', () => {
    const backing = memory(), seed = new GameStore(backing); seed.write({ ...seed.state, coins: 600 });
    const store = new GameStore({ getItem: backing.getItem, setItem: (k, raw) => { backing.setItem(k, raw); throw Error('lost ack'); } });
    expect(store.selectTheme('neon')).toBe('purchased');
    const recovered = new GameStore(backing); expect(recovered.selectTheme('neon')).toBe('unchanged');
    expect(recovered.state.coins).toBe(100);
  });
  it('rejects a stale writer after purchase instead of erasing ownership or restoring coins', () => {
    const storage = memory(), owner = new GameStore(storage); owner.write({ ...owner.state, coins: 500 });
    const stale = new GameStore(storage); owner.selectTheme('sunset');
    expect(() => stale.path(levels[0]!, [0, 1])).toThrow('another writer');
    expect(new GameStore(storage).state).toMatchObject({ coins: 0, themeId: 'sunset', ownedThemes: [...freeThemeIds, 'sunset'] });
  });
  it('later route autosaves and first/repeat rewards preserve the equipped purchase', () => {
    const storage = memory(), store = new GameStore(storage); store.write({ ...store.state, coins: 700 }); store.selectTheme('honey');
    store.path(levels[0]!, [0, 1]); store.finish(levels[0]!, levels[0]!.witness); store.finish(levels[0]!, levels[0]!.witness);
    expect(new GameStore(storage).state).toMatchObject({ coins: 220, themeId: 'honey', ownedThemes: [...freeThemeIds, 'honey'] });
  });
  it('keeps catalog ids unique, two free entries and six 500-coin entries', () => {
    expect(new Set(themes.map(t => t.id)).size).toBe(8);
    expect(themes.filter(t => t.price === 0)).toHaveLength(2);
    expect(themes.filter(t => t.price === 500)).toHaveLength(6);
  });
});
