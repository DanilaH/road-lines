# Startup runtime and diagnostics

Import from `@danilah/mini-games-kit/startup`.

The module preserves four independent production mechanisms. A game can use any subset.

## `StartupTimeline`

Create it at module/application entry, name your own phases, and derive intervals explicitly:

```ts
type Phase = 'platform' | 'save' | 'art' | 'ready';
const timeline = new StartupTimeline<Phase>();

timeline.mark('platform');
// save and art may intentionally overlap
timeline.mark('save');
timeline.mark('art');
timeline.mark('ready');

const snapshot = timeline.snapshot({
  startToReadyMs: ['start', 'ready'],
  platformToArtMs: ['platform', 'art'],
});
```

Marks are idempotent. The kit does not prescribe phase names or analytics vocabulary.

## `StartupResourceDiagnostics`

Create one at the beginning of a loader wall, call `record(key, requestUrl)` for every queued resource, then `finalize()` when that loader settles. The snapshot correlates those requests with Resource Timing and reports:

- queue/observed counts;
- loader wall and resource span;
- post-last-response settle tail;
- observed network concurrency;
- transfer and encoded KiB;
- cache-like entries and protocols;
- slowest resources with wait/download split.

Metadata is injected, so a caller can attach selected image format, experiment variant or engine loader concurrency without the diagnostic utility knowing those concepts.

`appendQueryToken()` and `buildStartupExperimentUrl()` support deliberate cold/debug experiments. Do not enable cache busting in normal production.

## `StartupPreloadController`

This controller owns a delayed startup overlay lifecycle and bounded fake progress that never reaches 100% before real completion. The view is injected; `createStartupPreloadDomView()` supplies a conventional DOM adapter.

A fatal timeout is diagnostic, not permanent ownership of readiness: if the real presentable-ready signal eventually arrives, `complete()` can still clear the overlay.

Call completion from the game's semantic **presentable/usable frame**, not merely when JavaScript or the platform SDK finished loading. A common pattern is to schedule removal after one or two animation frames so the authored game frame has actually painted.

## Diagnostic text export

`copyOrExposeText()` tries Clipboard API, then legacy synchronous copy, then leaves a visible selected textarea. This order is deliberate: hosted game iframes may expose `navigator.clipboard` but reject `writeText()` through permissions policy.

## Non-goals

The module does not decide which assets are startup-critical, when Yandex `LoadingAPI.ready()` is correct, how Phaser is configured, or what startup threshold is acceptable. Those remain game/platform policy.
