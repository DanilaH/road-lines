import { describe, it, expect } from 'vitest';
import { levels } from '../src/content/levels';
import { advance, complete, validPath, type Level } from '../src/core/model';
import { solve, findHint } from '../src/core/solver';
import { decodeSave, defaultSave, GameStore } from '../src/services/save';

const square = { ...levels[2]!, finish: 3 };
const wall: Level = { ...levels[2]!, walls: [[0, 1]] };
const numbered: Level = { ...levels[2]!, checkpoints: [0, 4, 2] };

describe('finish, walls and ordered checkpoints', () => {
  it('reserves the finish for the final move and accepts any legal ending', () => {
    expect(advance(square, [0], 3)).toEqual([0]);
    expect(validPath(square, [0, 3])).toBe(false);
    expect(complete(square, [0, 3, 4, 1, 2, 5])).toBe(false);
    expect(complete(square, [0, 1, 2, 5, 4, 3])).toBe(true);
  });
  it('blocks a wall from both sides without blocking its cells', () => {
    expect(advance(wall, [0], 1)).toEqual([0]);
    expect(advance(wall, [0, 3, 4, 1], 0)).toEqual([0, 3, 4, 1]);
    expect(validPath(wall, [0, 1])).toBe(false);
    expect(complete(wall, [0, 3, 4, 1, 2, 5])).toBe(true);
  });
  it('rejects a future number and derives checkpoint progress again after undo', () => {
    expect(advance(numbered, [0, 1], 2)).toEqual([0, 1]);
    const reached = advance(numbered, [0, 1], 4);
    expect(reached).toEqual([0, 1, 4]);
    expect(advance(numbered, reached, 5)).toEqual([0, 1, 4, 5]);
    const undone = advance(numbered, reached, 1);
    expect(advance(numbered, undone, 2)).toEqual([0, 1]);
    expect(advance(numbered, undone, 4)).toEqual(reached);
  });
  it('matches an independent exhaustive oracle for all prefixes, including dead ends', () => {
    for (const level of [square, wall, numbered, { ...numbered, walls: [[0, 3]] as const, finish: 3 }]) {
      const outcomes = new Map<string, boolean>();
      const oracle = (route: number[]): boolean => {
        let any = route.length === level.cells.length && (level.finish === undefined || route.at(-1) === level.finish);
        const head = route.at(-1)!;
        for (const c of level.cells) {
          if (route.includes(c) || Math.abs(head % level.width - c % level.width) + Math.abs(Math.floor(head / level.width) - Math.floor(c / level.width)) !== 1) continue;
          if (level.walls?.some(([a, b]) => (a === head && b === c) || (b === head && a === c))) continue;
          if (c === level.finish && route.length < level.cells.length - 1) continue;
          const n = level.checkpoints?.indexOf(c) ?? -1;
          if (n >= 0 && !level.checkpoints!.slice(0, n).every(p => route.includes(p))) continue;
          const child = oracle([...route, c]); any = child || any;
        }
        outcomes.set(route.join(','), any); return any;
      };
      oracle([level.start]);
      for (const [key, found] of outcomes) {
        const prefix = key.split(',').map(Number), answer = solve(level, prefix, { budgetMs: 500 });
        expect(validPath(level, prefix), key).toBe(true);
        expect(answer.kind, key).toBe(found ? 'FOUND' : 'UNSOLVABLE');
        if (answer.kind === 'FOUND') expect(complete(level, answer.path)).toBe(true);
      }
    }
  });
  it('finds free rollback help on a constrained dead end; budget exhaustion stays UNKNOWN', () => {
    const level = levels.find(l => l.id === 'walls-01')!;
    const answer = findHint(level, [0, 1]);
    expect(answer).toEqual({ kind: 'UNSOLVABLE', rollbackLength: 1 });
    expect(solve(level, [0], { maxNodes: 0 }).kind).toBe('UNKNOWN');
  });
  it('restores new rule drafts, repairs only illegal routes and preserves valuable state', () => {
    const level = levels.find(l => l.id === 'checkpoints-01')!;
    const seed = { ...defaultSave(), levelId: level.id, levelVersion: level.version, path: level.witness.slice(0, 5), coins: 123, hints: 2, completed: ['intro-01'] };
    expect(decodeSave(JSON.stringify(seed))).toMatchObject({ path: seed.path, coins: 123, hints: 2, completed: seed.completed });
    const broken = { ...seed, path: [0, 1, 2, 5, 8] };
    expect(decodeSave(JSON.stringify(broken))).toMatchObject({ path: [0], coins: 123, hints: 2, completed: seed.completed });
  });
  it('cannot pay for a full geometric route that violates new rules', () => {
    let raw: string | null = null;
    const store = new GameStore({ getItem: () => raw, setItem: (_k, v) => { raw = v; } });
    const level = levels.find(l => l.id === 'finish-01')!;
    expect(() => store.finish(level, [0, 1, 2, 5, 8, 7, 4, 3, 6])).toThrow('Incomplete');
    expect(store.state.coins).toBe(0);
    store.finish(level, level.witness);
    expect(new GameStore({ getItem: () => raw, setItem: (_k, v) => { raw = v; } }).finish(level, level.witness)).toBe(0);
    expect(store.state.coins).toBe(20);
  });
});
