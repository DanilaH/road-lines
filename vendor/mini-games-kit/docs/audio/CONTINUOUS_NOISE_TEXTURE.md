# `ContinuousNoiseTexture`

Import from `@danilah/mini-games-kit/audio`.

## What it is

A reusable WebAudio texture for drag/scrub/tear-like interactions. It turns normalized progress and velocity into a bounded noise gain, band-pass frequency and Q response.

## Public API

```ts
const texture = new ContinuousNoiseTexture(context, dragBus, profile);
texture.prime();
texture.update(progress, normalizedVelocity);
texture.stop();
texture.dispose();
```

For tuning/tests without constructing an audio graph:

```ts
const mix = resolveContinuousNoiseTextureMix(profile, progress, velocity, startupProgress);
```

`createLoopableNoiseBuffer(context)` creates a deterministic loopable noise source and can also be supplied explicitly to the class.

## Profile knobs

`minGain/maxGain`, spectral band, Q range, progress/velocity weights, smoothing/update time, startup attack/cap and idle/release timings are all explicit. This prevents the common failure where a first pointer movement produces a harsh broadband burst.

## Boundary

The class never reads pointer events. Feed it values from `sampleContinuousInteraction()` or equivalent game logic. Stop/dispose it on cancellation and scene teardown.
