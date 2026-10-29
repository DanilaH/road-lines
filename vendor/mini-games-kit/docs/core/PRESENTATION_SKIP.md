# `PresentationSkipController`

Import from `@danilah/mini-games-kit/core`.

## What it is

A tiny owner for the **currently skippable presentation beat**. It lets input such as tap/click/space finish an animation early without letting the skip system own rewards, saves, economy or other durable game state.

## Public API

```ts
const skip = new PresentationSkipController();

skip.register(() => finishCurrentAnimation());
skip.guardUntilTime(performance.now() + 150);
skip.request(performance.now());
skip.hasActiveBeat();
skip.reset();
```

`register(action)` returns a disposer. The disposer only removes that exact action, so disposing an older beat cannot accidentally clear a newer one.

`request(now)` executes at most one registered action and returns whether a beat was actually consumed. `guardUntilTime()` is useful for short anti-double-tap/readability windows.

## Intended use

Commit or stage gameplay truth independently, then register only the presentation completion path:

```ts
const unregister = skip.register(() => revealTween.complete());
scene.events.once('shutdown', unregister);
```

## Guarantees and non-goals

The controller never stores transaction state and never decides what a skip means for gameplay. It is not an animation scheduler or a state machine. A skipped sequence must converge to the same durable result as the unskipped sequence.
