import { describe, it, expect } from 'vitest';
import { levels } from '../src/content/levels';
import { advance, complete, validPath } from '../src/core/model';
import { solve, findHint } from '../src/core/solver';
import { boardLayout, cellRect } from '../src/ui/layout';
import { crossedCells } from '../src/core/gesture';
import { GameStore, decodeSave } from '../src/services/save';

describe('route invariants', () => {
  const square = levels[2]!;
  it('accepts a legal solution different from the stored witness', () => {
    const alternatives = [[0, 1, 2, 5, 4, 3], [0, 3, 4, 1, 2, 5]];
    for (const p of alternatives) expect(complete(square, p)).toBe(true);
    expect(alternatives.some(p => String(p) !== String(square.witness))).toBe(true);
  });
  it('rejects row wrapping, diagonal moves, duplicates, old-cell teleport and holes', () => {
    expect(advance(square, [0], 4)).toEqual([0]);
    expect(advance(square, [0, 1, 2], 3)).toEqual([0, 1, 2]);
    expect(advance(square, [0, 1, 4, 3], 0)).toEqual([0, 1, 4, 3]);
    expect(validPath(square, [0, 1, 0])).toBe(false);
    expect(advance(levels[3]!, [0, 1], 4)).toEqual([0, 1]);
  });
  it('backtracks only through consecutive reversed edges', () => {
    let path = [0, 1, 2];
    path = advance(square, path, 1); path = advance(square, path, 0);
    expect(path).toEqual([0]);
  });
  it('processes a full fast row and exact reverse without skipping', () => {
    const level = levels[0]!, layout = boardLayout(390, 600, false, level);
    const center = (c: number) => { const r = cellRect(level, layout, c); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    expect(crossedCells(level, layout, center(0), center(2))).toEqual([0, 1, 2]);
    expect(crossedCells(level, layout, center(2), center(0))).toEqual([2, 1, 0]);
    expect(crossedCells(level, layout, { x: -20, y: 0 }, { x: 500, y: 0 })).toEqual([]);
  });
});

describe('bounded solver', () => {
  it('matches an independent exhaustive oracle on every small-board prefix', () => {
    for (const level of [levels[2]!, levels[3]!]) {
      const outcomes = new Map<string, boolean>();
      const oracle = (path: number[]): boolean => {
        if (path.length === level.cells.length) { outcomes.set(path.join(','), true); return true; }
        const head = path[path.length - 1]!;
        let any = false;
        for (const cell of level.cells) {
          if (path.includes(cell)) continue;
          const dx = Math.abs(head % level.width - cell % level.width);
          const dy = Math.abs(Math.floor(head / level.width) - Math.floor(cell / level.width));
          if (dx + dy !== 1) continue;
          const child = oracle([...path, cell]); any = any || child;
        }
        outcomes.set(path.join(','), any); return any;
      };
      oracle([level.start]);
      for (const [key, hasSolution] of outcomes) expect(solve(level, key.split(',').map(Number), { budgetMs: 500 }).kind, key).toBe(hasSolution ? 'FOUND' : 'UNSOLVABLE');
    }
  });

  it('finds compatible solutions for every authored prefix', () => {
    for (const level of levels) for (let n = 1; n < level.witness.length; n++) {
      const prefix = level.witness.slice(0, n), result = solve(level, prefix, { budgetMs: 500 });
      expect(result.kind, level.id).toBe('FOUND');
      if (result.kind === 'FOUND') { expect(result.path.slice(0, n)).toEqual(prefix); expect(complete(level, result.path)).toBe(true); }
    }
  });
  it('proves a dead prefix and proposes the nearest recoverable prefix', () => {
    const level = levels[2]!, prefix = [0, 1, 4];
    expect(solve(level, prefix).kind).toBe('UNSOLVABLE');
    expect(findHint(level, prefix)).toEqual({ kind: 'UNSOLVABLE', rollbackLength: 2 });
  });
  it('returns UNKNOWN when search budget is exhausted, not UNSOLVABLE', () => {
    expect(solve(levels[2]!, [0], { maxNodes: 0 }).kind).toBe('UNKNOWN');
    expect(solve(levels[2]!, [0], { budgetMs: 0, now: () => 0 }).kind).toBe('UNKNOWN');
  });
});

describe('save ownership', () => {
  const memory = () => { let raw: string | null = null; return { getItem: () => raw, setItem: (_k: string, v: string) => { raw = v; } }; };
  it('roundtrips progress, prefix, hints and exactly-once first reward after reload', () => {
    const storage = memory(), a = new GameStore(storage), level = levels[2]!;
    a.path(level, [0, 3]);
    const b = new GameStore(storage); expect(b.state.path).toEqual([0, 3]);
    b.write({ ...b.state, hints: 2 });
    expect(b.finish(level, level.witness)).toBe(20);
    expect(new GameStore(storage).finish(level, level.witness)).toBe(0);
    expect(new GameStore(storage).state).toMatchObject({ coins: 20, hints: 2, completed: [level.id] });
  });
  it('rejects a stale writer instead of overwriting another saved baseline', () => {
    const storage = memory(), a = new GameStore(storage), b = new GameStore(storage);
    a.path(levels[0]!, [0, 1]);
    expect(() => b.path(levels[0]!, [0])).toThrow('another writer');
    expect(new GameStore(storage).state.path).toEqual([0, 1]);
  });
  it('skips identical ordinary prefixes while retaining conflict and recovery guards', () => {
    const backing = memory(); let writes = 0;
    const storage = { getItem: backing.getItem, setItem(k: string, raw: string) { writes++; backing.setItem(k, raw); } };
    const a = new GameStore(storage), level = levels[0]!;
    a.path(level, [0, 1]); const before = writes;
    for (let i = 0; i < 8; i++) a.path(level, [0, 1]);
    expect(writes).toBe(before);
    const other = new GameStore(storage); other.finish(level, level.witness);
    expect(() => a.path(level, [0, 1])).toThrow('another writer');
    expect(() => a.path(level, [0, 1])).toThrow('reload required');
    expect(new GameStore(storage).state.coins).toBe(20);
  });
  it('persists a canonical snapshot before skipping unchanged legacy or new prefixes', () => {
    for (const legacy of [true, false]) {
      const backing = memory(); let writes = 0;
      if (legacy) backing.setItem('', JSON.stringify({ version: 1, levelId: 'intro-01', levelVersion: 1, path: [0], completed: [], coins: 0, hints: 3 }));
      const storage = { getItem: backing.getItem, setItem(k: string, raw: string) { writes++; backing.setItem(k, raw); } };
      const a = new GameStore(storage);
      a.path(levels[0]!, [0]);
      expect(JSON.parse(backing.getItem()!)).toMatchObject({ version: 3, themeId: 'classic', ownedThemes: ['classic', 'mint'] });
      a.path(levels[0]!, [0]); expect(writes).toBe(1);
      a.reload(); a.path(levels[0]!, [0]); expect(writes).toBe(1);
    }
  });
  it('still persists clearing an offer for an unchanged unfinished prefix', () => {
    const storage = memory(), a = new GameStore(storage);
    for (const level of levels.slice(0, 10)) a.finish(level, level.witness);
    const level = levels[9]!, prefix = [level.start];
    a.write({ ...a.state, path: prefix });
    expect(a.state.offer).not.toBeNull();
    a.path(level, prefix);
    expect(new GameStore(storage).state.offer).toBeNull();
    expect(a.state.coins).toBe(200);
  });
  it('repairs only invalid transient path and preserves currency', () => {
    const storage = memory(), a = new GameStore(storage); a.finish(levels[0]!, levels[0]!.witness);
    const state = decodeSave(JSON.stringify({ ...a.state, path: [999] }));
    expect(state.path).toEqual([levels[0]!.start]); expect(state.coins).toBe(20);
    expect(() => decodeSave(JSON.stringify({ ...a.state, coins: '20' }))).toThrow();
  });
  it('does not reset unreadable saves or claim a failed grant', () => {
    expect(() => new GameStore({ getItem: () => '{bad', setItem: () => {} })).toThrow();
    const a = new GameStore({ getItem: () => null, setItem: () => { throw Error('full'); } });
    expect(() => a.finish(levels[0]!, levels[0]!.witness)).toThrow();
    expect(a.state.coins).toBe(0); expect(a.recoveryRequired).toBe(true);
  });
  it('verifies ambiguous persisted writes instead of double-granting', () => {
    const memoryStorage = memory();
    const storage = { ...memoryStorage, setItem(k: string, raw: string) { memoryStorage.setItem(k, raw); throw Error('lost ack'); } };
    const a = new GameStore(storage); expect(a.finish(levels[0]!, levels[0]!.witness)).toBe(20);
    expect(a.finish(levels[0]!, levels[0]!.witness)).toBe(0); expect(a.state.coins).toBe(20);
    expect(storage.getItem()).not.toBeNull();
  });
});
