# `PresentationAudioMixer`

Import from `@danilah/mini-games-kit/audio`.

## What it is

A WebAudio lifecycle owner for one stable base ambience plus at most one persistent foreground presentation state. It solves repeated production problems around ambience replacement, ducking, mute/block suspension and deterministic teardown while keeping timbre in game-provided factories.

## Public API

```ts
const mixer = new PresentationAudioMixer<Rarity>({
  base: {
    gain: 0.18,
    fadeInMs: 800,
    create: (context, output) => createRoomBed(context, output),
  },
  resolvePersistent: (rarity) => rarityProfiles[rarity],
  destination: masterGain,
});

mixer.prime();
mixer.setPersistentState('epic');
mixer.duckBase({ multiplier: 0.25, attackMs: 40, holdMs: 120, releaseMs: 220 });
mixer.setPersistentProgress(0.7);
mixer.clearPersistentState();
mixer.setMuted(true);
mixer.setBlocked(true);
mixer.dispose();
```

`destination` may be an `AudioNode` or `(context) => AudioNode`; omit it to connect to `context.destination`.

`areStatesEqual(left, right)` is optional. Primitive state keys work with the default `Object.is`. If state is object-shaped, provide a semantic comparator so recreating an equivalent object does not restart ambience.

## Layer contract

Factories return `ManagedAudioLayer` with idempotent `disconnect()` and a `stop(atTime)` method. `createManagedAudioLayer()` is a convenience for a fixed set of sources/nodes.

## Lifecycle guarantees

- baseline ambience is not recreated for every result;
- only one persistent state owns foreground attention at a time;
- mute/block suspend the existing context instead of stacking replacements;
- replacement fade cleanup is tracked and flushed synchronously on `dispose()`;
- the mixer never owns reward/economy/save state.

## Non-goals

It does not define musical content, rarity hierarchy or transient cue priority. Those remain in the game/profile layer.
