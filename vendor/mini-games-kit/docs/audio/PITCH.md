# Pitch helpers

Import from `@danilah/mini-games-kit/audio`.

## What it is

Small presentation-only helpers for avoiding mechanically identical repeated cues and for giving a banking/accumulation sequence a controlled rising contour.

## Public API

```ts
const playbackRate = applyBoundedPitchVariation(0.03, cosmeticRandom.next());

const multiplier = getAccumulationPitchMultiplier(
  transferProgress,
  { startMultiplier: 0.92, endMultiplier: 1.18, jitterAmount: 0.012 },
  cosmeticRandom.next(),
);
```

Both APIs expect a unit random sample in `[0, 1]` and keep output bounded by the configured range.

## Important boundary

This randomness is presentation-only. Do not consume gameplay/loot RNG to vary sound pitch. A game should use a separate cosmetic source or `Math.random()` when determinism is not required.
