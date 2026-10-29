# Continuous interaction semantics

Import from `@danilah/mini-games-kit/core`.

## What it is

Helpers that turn project-specific drag/scrub/tear geometry into stable normalized inputs for feel systems.

## Public API

```ts
const progress = normalizePositiveProgress(distancePx, completionDistancePx);
const sample = sampleContinuousInteraction(
  progress,
  previousProgress,
  performance.now(),
  previousTimestamp,
  {
    velocityForMax: 4,
    minActiveProgress: 0.005,
    minActiveProgressDelta: 0.0005,
  },
);
```

The returned sample contains normalized `progress`, absolute `progressDelta`, elapsed seconds, bounded `normalizedVelocity`, `active`, and `completed`.

## Intended use

Keep hitboxes and pointer geometry in the game. Feed the semantic sample into audio, material response, particles or motion:

```ts
if (sample.active) dragAudio.update(sample.progress, sample.normalizedVelocity);
```

## Important boundary

The helper intentionally does not know pointer coordinates, Phaser input objects or completion policy. `progressDelta` is absolute; direction-sensitive scrubbing should keep signed direction in the consuming game until a real shared requirement proves a generic directional API is useful.
