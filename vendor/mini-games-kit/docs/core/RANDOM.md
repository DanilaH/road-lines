# Randomness API

Import from `@danilah/mini-games-kit/core`.

## What it is

A deliberately small injectable randomness boundary for gameplay logic.

## Public API

```ts
interface RandomSource {
  next(): number; // must return [0, 1)
}

const random = new MathRandomSource();
const reward = pickWeighted(
  [
    { value: 'common', weight: 80 },
    { value: 'rare', weight: 20 },
  ],
  random,
);
```

`nextUnit(random)` validates the source and throws if it returns a non-finite value or a value outside `[0, 1)`.

`pickWeighted(entries, random)` ignores non-positive/non-finite weights and throws if no usable entry remains.

## Why this exists

Games should be able to inject deterministic RNG in tests and, more importantly, keep gameplay/economy randomness separate from cosmetic randomness such as pitch jitter or particles.

## Non-goals

This module is not a seedable PRNG implementation, probability-balancing system or loot policy. Consumers decide how a `RandomSource` is created and which decisions are allowed to consume it.
