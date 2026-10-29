# Value transfer planning

Import from `@danilah/mini-games-kit/core`.

## What it is

A bounded presentation planner for values that are **already owned** by gameplay state: currency banking, score transfer, XP, shards, etc.

The key contract is that semantic value is not the same thing as visual density.

## Public API

```ts
const plan = createValueTransferPlan(5_000, {
  minDurationMs: 300,
  maxDurationMs: 900,
  maxVisualTokens: 24,
  maxAudioEvents: 12,
});

for (let index = 0; index < plan.visualTokenCount; index += 1) {
  const delay = valueTransferEmissionDelay(plan, index);
  const counterValue = valueAfterVisualArrival(plan, index);
  const shouldClick = shouldPlayValueTransferCue(plan, index);
}
```

`valueTransferProgress()` returns normalized arrival progress for pitch/mix/effects.

## Why this matters

A transfer of `+5000` can animate 24 objects and 12 sound events while the counter still lands exactly on `+5000`. This keeps large rewards satisfying without creating thousands of game objects or audio events.

## Non-goals

This planner does not mutate currency and does not decide flight paths, sprites, easing or destination anchors. Commit value first; presentation observes it.
