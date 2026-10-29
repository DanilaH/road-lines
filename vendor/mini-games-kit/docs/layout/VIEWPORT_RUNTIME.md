# Mobile viewport runtime

Import from `@danilah/mini-games-kit/layout`.

This is separate from logical layout math. It preserves browser-runtime behavior learned from real Android Chrome/WebView rotation failures.

## Coherent viewport snapshot

`resolveViewportState()` resolves orientation and dimensions as one decision. Layout viewport geometry (`innerWidth/innerHeight` and document element geometry) is primary; `matchMedia('(orientation: portrait)')` is a disagreement tie-breaker. `visualViewport` is preferred for size only when its orientation agrees with the resolved orientation.

This avoids the common rotation window where `visualViewport`, orientation APIs and layout geometry describe different frames.

For a landscape-only game, `resolveInitialLandscapeGameCssSize()` gives a provisional landscape surface while a portrait DOM gate covers the game. Scenes therefore do not author a tall layout that survives into the first visible landscape frame.

## `BrowserViewportWatcher`

The watcher listens to resize/orientation/page/focus, `visualViewport`, screen orientation and media-query changes. One event produces:

1. immediate apply;
2. next-animation-frame apply;
3. bounded settle applies;
4. a watchdog catches geometry changes when the useful browser event is dropped.

`onApply(viewport, { reason, changed })` is intentionally invoked on settle passes even when dimensions did not change. An engine adapter can resize when `changed` is true but still issue its own refresh/re-layout signal after a portrait→landscape lifecycle transition that returns to numerically identical dimensions.

## Important engine policy

`shouldSyncLandscapeBackingStore()` encodes only a generic recommendation: when a portrait gate fully covers a landscape-only game, avoid mutating the engine backing store in portrait. Do not automatically suspend the render loop merely because orientation is gated; ads, platform pause and document visibility are separate lifecycle reasons.

The kit does not resize Phaser directly. That remains an adapter/application decision.
