# `GameplayActivityCoordinator`

Import from `@danilah/mini-games-kit/platform`.

## What it is

A single source for whether the game **wants** gameplay active and whether external systems currently **allow** it. Multiple blockers (ad, platform pause, visibility, orientation, modal, etc.) can overlap without accidentally resuming gameplay too early.

## Public API

```ts
const activity = new GameplayActivityCoordinator(
  () => yandexGameplayApi.start(),
  () => yandexGameplayApi.stop(),
);

activity.setGameplayDesired(true);
activity.setBlocked('ad', true);
activity.setBlocked('platform', true);
activity.setBlocked('ad', false);       // still blocked
activity.setBlocked('platform', false); // resumes

const unsubscribe = activity.onBlockedChange((blocked) => audio.setBlocked(blocked));
```

Late subscribers immediately receive the current aggregate blocked state.

## Browser bridges

`installDocumentVisibilityBlocker(activity, reason?)` mirrors `document.hidden` into a semantic blocker and returns a disposer.

`installViewportOrientationBlocker(activity, source?, options?)` mirrors viewport orientation into a blocker. The default policy blocks portrait viewports:

```ts
const disposeOrientation = installViewportOrientationBlocker(activity, window, {
  reason: 'orientation',
  onChange: (blocked) => {
    orientationGate.dataset.visible = blocked ? 'true' : 'false';
  },
});
```

For a different product rule, inject `isBlocked(width, height)` rather than changing the coordinator:

```ts
installViewportOrientationBlocker(activity, window, {
  isBlocked: (width, height) => width < 700 || height > width,
});
```

Both browser helpers perform an initial sync immediately and return deterministic cleanup functions.

## Non-goals

The coordinator does not pause Phaser, audio or timers directly. It only owns blocker aggregation and the start/stop edge; consumers wire those edges to their runtime.

The orientation helper does not render a rotate-device overlay or choose product breakpoints. It only reports the injected viewport rule as a blocker.
