# Render density helpers

Import from `@danilah/mini-games-kit/core`.

## What it is

Small browser-safe helpers for keeping HiDPI rendering sharp without allowing uncontrolled backing-store growth.

## Public API

```ts
const ratio = getRenderPixelRatio(); // defaults to a 2x cap
const custom = resolveRenderPixelRatio(window.devicePixelRatio, 2.5);
const backing = getBackingStoreSize(cssWidth, cssHeight, ratio);
```

`MAX_RENDER_PIXEL_RATIO` is the current conservative default (`2`). A game can pass a different cap when its renderer/performance budget proves it appropriate.

## Non-goals

These helpers do not resize a Phaser game or canvas by themselves. They only resolve density and backing-store dimensions; renderer configuration stays with the consumer.
