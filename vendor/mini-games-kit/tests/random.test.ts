import { describe, expect, it } from 'vitest';

import { nextUnit, pickWeighted, type RandomSource } from '../src/core/random';

const fixedRandom = (value: number): RandomSource => ({ next: () => value });

describe('random boundary', () => {
  it('accepts only unit-interval samples', () => {
    expect(nextUnit(fixedRandom(0))).toBe(0);
    expect(nextUnit(fixedRandom(0.999))).toBe(0.999);
    expect(() => nextUnit(fixedRandom(1))).toThrow(/invalid sample/);
    expect(() => nextUnit(fixedRandom(-0.01))).toThrow(/invalid sample/);
    expect(() => nextUnit(fixedRandom(Number.NaN))).toThrow(/invalid sample/);
  });

  it('ignores non-positive and non-finite weights', () => {
    const entries = [
      { value: 'ignored-zero', weight: 0 },
      { value: 'ignored-negative', weight: -4 },
      { value: 'a', weight: 2 },
      { value: 'ignored-nan', weight: Number.NaN },
      { value: 'b', weight: 2 },
    ] as const;

    expect(pickWeighted(entries, fixedRandom(0))).toBe('a');
    expect(pickWeighted(entries, fixedRandom(0.75))).toBe('b');
  });

  it('rejects an unusable weighted set', () => {
    expect(() => pickWeighted([{ value: 'x', weight: 0 }], fixedRandom(0.5))).toThrow(/zero-weight/);
  });
});
