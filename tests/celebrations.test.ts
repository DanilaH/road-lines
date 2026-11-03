import { describe, it, expect } from 'vitest';
import { themes, type Theme } from '../src/content/themes';
import { GameStore, defaultSave, decodeSave } from '../src/services/save';
import { WheelService } from '../src/services/wheel';
import { wheelCoinReward } from '../src/core/rewards';
import { themeSuggestions } from '../src/core/theme-suggestions';
import { SoundSequence } from '../src/presentation/sound-sequence';
const date = '2026-11-02';
const memory = () => { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; } }; };
describe('rare theme transaction', () => {
  it('stages one unowned target before animation and recovers that exact target once', async () => {
    const storage = memory(), first = new GameStore(storage);
    await new WheelService(first, () => 7, () => 'rare', () => 3).prepare(date);
    expect(first.state.daily.pending?.themeId).toBe('honey'); expect(first.state.ownedThemes).not.toContain('honey');
    const next = new GameStore(storage), recovery = new WheelService(next, () => { throw Error('rerolled'); });
    await recovery.prepare('2026-11-03'); await recovery.commit(); await recovery.commit();
    expect(next.state.coins).toBe(0); expect(next.state.themeId).toBe('classic');
    expect(next.state.ownedThemes.filter(id => id === 'honey')).toHaveLength(1);
    expect(decodeSave(JSON.stringify(next.state)).daily.last?.themeId).toBe('honey');
    expect(next.selectTheme('honey')).toBe('equipped'); expect(next.state.coins).toBe(0);
  });
  it('keeps all legacy numeric pending awards, including sector 7 = 300', async () => {
    for (let sector = 0; sector < 8; sector++) {
      const store = new GameStore(memory()); store.stageSpin({ id: 'old', date, sector });
      const expected = wheelCoinReward(store.state.daily.pending!); store.commitSpin('old');
      expect(store.state.coins).toBe(expected); expect(store.state.ownedThemes).toEqual(['classic', 'mint']);
    }
  });
  it('selects a theme in exactly one of eight equal sectors; collected themes cannot drop', async () => {
    for (let sector = 0; sector < 8; sector++) {
      const store = new GameStore(memory()); await new WheelService(store, () => sector, () => 'a', () => 0).prepare(date);
      expect(Boolean(store.state.daily.pending?.themeId)).toBe(sector === 7);
    }
    const all = new GameStore(memory()); all.write({ ...all.state, ownedThemes: themes.map(t => t.id) });
    await new WheelService(all, () => 7, () => 'b').prepare(date); await new WheelService(all).commit(); expect(all.state.coins).toBe(300);
  });
  it('substitutes 300 only when the fixed target was obtained while the spin was pending', async () => {
    const store = new GameStore(memory()); store.write({ ...store.state, coins: 500 });
    const service = new WheelService(store, () => 7, () => 'a', () => 0); await service.prepare(date);
    store.selectTheme('lagoon'); await service.commit();
    expect(store.state).toMatchObject({ coins: 300, themeId: 'lagoon', daily: { last: { themeId: 'lagoon', fallback: true } } });
    expect(store.state.ownedThemes.filter(id => id === 'lagoon')).toHaveLength(1);
  });
  it('retains the theme target after failed commit; lost acknowledgements cannot duplicate it', async () => {
    const storage = memory(), store = new GameStore(storage); await new WheelService(store, () => 7, () => 'a', () => 2).prepare(date);
    const failed = new GameStore({ getItem: storage.getItem, setItem: () => { throw Error('disk'); } });
    await expect(new WheelService(failed).commit()).rejects.toThrow();
    expect(new GameStore(storage).state.daily.pending?.themeId).toBe('lavender');
    const uncertain = new GameStore({ getItem: storage.getItem, setItem: (k, v) => { storage.setItem(k, v); throw Error('ack'); } });
    const recovery = new WheelService(uncertain); await recovery.commit(); await recovery.commit();
    expect(new GameStore(storage).state.ownedThemes.filter(id => id === 'lavender')).toHaveLength(1);
  });
  it('rejects malformed valuable theme ledgers without resetting the wallet', () => {
    for (const patch of [{ sector: 0, themeId: 'lagoon' }, { sector: 7, themeId: 'mint' }, { sector: 7, themeId: 'unknown' }, { sector: 7, themeId: 'lagoon', fallback: true }]) {
      expect(() => decodeSave(JSON.stringify({ ...defaultSave(), coins: 500, daily: { lastDate: date, pending: { id: 'bad', date, ...patch }, last: null } }))).toThrow();
    }
  });
});
describe('cosmetic suggestions and sound variation', () => {
  it('rotates away from the previous candidate and never suggests owned themes', () => {
    let last: string | null = null;
    for (let i = 0; i < 20; i++) {
      const next: Theme = themeSuggestions(['classic', 'mint'], 20, last, () => .5)[0]!;
      expect(next.id).not.toBe(last); expect(next.price).toBeGreaterThan(0); last = next.id;
    }
    expect(themeSuggestions(themes.map(t => t.id), 1000, last)).toEqual([]);
    for (const theme of themeSuggestions(['classic','mint','lagoon'], 500, null)) expect(theme.id).not.toBe('lagoon');
  });
  it('uses discrete consonant notes and same-pitch strike variants without detuning any cue', () => {
    for (const random of [() => 0, () => .999]) {
      const sound = new SoundSequence(random);
      for (let level = 1; level < 30; level++) {
        sound.beginLevel('intro-' + level); let previousIndex = -1, previousNote: number | undefined;
        for (let i = 0; i < 40; i++) {
          const choice = sound.next('cell', i / 40), note = 12 * Math.log2(choice.rate);
          expect(choice.index).not.toBe(previousIndex); previousIndex = choice.index;
          expect([0,2,4,7].some(n => Math.abs(n-note) < 1e-9)).toBe(true);
          if (previousNote !== undefined) expect(Math.abs(note-previousNote)).toBeLessThanOrEqual(3.000001);
          previousNote = note;
        }
        for (const cue of ['coin','button','undo','win','progress','star','gift','reject'] as const)
          for (let i = 0; i < 20; i++) expect(sound.next(cue, i/20).rate).toBe(1);
      }
    }
  });
  it('unrelated button/coin sounds cannot consume the cell melody; stars restart on a win', () => {
    const a = new SoundSequence(() => .5), b = new SoundSequence(() => .5); a.beginLevel('intro-01'); b.beginLevel('intro-01');
    for (let i = 0; i < 20; i++) { a.next('button', 0); a.next('coin', .5); expect(a.next('cell', 0)).toEqual(b.next('cell', 0)); }
    a.next('star', 0); a.next('star', 0); a.next('win', 0); expect(a.next('star', 0).index).toBe(0);
  });
});
