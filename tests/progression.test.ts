import { describe, it, expect } from 'vitest';
import { levels } from '../src/content/levels';
import { isLevelAvailable } from '../src/core/progression';
import { GameStore, decodeSave, defaultSave } from '../src/services/save';

const memory = () => { let raw: string | null = null; return { getItem: () => raw, setItem: (_k: string, v: string) => { raw = v; } }; };

describe('level selection and durable drafts', () => {
  it('opens only the first unfinished level, allows repeats and rejects unknown levels', () => {
    const done = levels.slice(0, 4).map(l => l.id);
    expect(levels.filter(l => isLevelAvailable(l.id, [])).map(l => l.id)).toEqual([levels[0]!.id]);
    expect(levels.filter(l => isLevelAvailable(l.id, done)).map(l => l.id)).toEqual(levels.slice(0, 5).map(l => l.id));
    expect(isLevelAvailable('missing', done)).toBe(false);
  });
  it('does not unlock later gaps from a stray completion', () => {
    expect(isLevelAvailable(levels[3]!.id, [levels[2]!.id])).toBe(false);
    expect(isLevelAvailable(levels[2]!.id, [levels[2]!.id])).toBe(true);
  });
  it('migrates legacy saves without changing wallet, completions or current prefix', () => {
    const legacy: Partial<ReturnType<typeof defaultSave>> = { ...defaultSave(), coins: 71, path: [0, 1] };
    delete legacy.drafts;
    const migrated = decodeSave(JSON.stringify(legacy));
    expect(migrated).toMatchObject({ coins: 71, completed: [], path: [0, 1], drafts: { 'intro-01': { version: 1, path: [0, 1] } } });
  });
  it('preserves each partial route across switches and reloads', () => {
    const storage = memory(), store = new GameStore(storage);
    store.path(levels[0]!, [0, 1]); store.path(levels[2]!, [0, 3]);
    const restored = new GameStore(storage);
    restored.path(levels[0]!, restored.state.drafts[levels[0]!.id]!.path);
    expect(restored.state.path).toEqual([0, 1]);
    expect(restored.state.drafts[levels[2]!.id]!.path).toEqual([0, 3]);
  });
  it('repairs invalid or stale drafts without repairing valuable progression', () => {
    const save = { ...defaultSave(), coins: 123, drafts: { 'intro-02': { version: 1, path: [999] }, 'intro-03': { version: 0, path: [0, 3] } } };
    expect(decodeSave(JSON.stringify(save))).toMatchObject({ coins: 123, drafts: { 'intro-01': { version: 1, path: [0] } } });
    expect(() => decodeSave(JSON.stringify({ ...save, completed: ['unknown'] }))).toThrow();
  });
  it('repeat selection and finish never grant again or discard another draft', () => {
    const storage = memory(), store = new GameStore(storage), first = levels[0]!;
    store.finish(first, first.witness); store.path(levels[2]!, [0, 3]);
    store.path(first, [first.start]); expect(store.finish(first, first.witness)).toBe(0);
    expect(new GameStore(storage).state).toMatchObject({ coins: 20, completed: [first.id], drafts: { 'intro-03': { path: [0, 3] } } });
  });
});
