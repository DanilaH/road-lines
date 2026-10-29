# Android WebView ads: implementation specification

Production knowledge from [Seeds](https://github.com/DanilaH/mini-games-kit/blob/d4dee18c9b466e2b4a68d8d481db6dfc50ec9ee5/docs/SEEDS_EXTRACTION.md), not a bundled Java/Capacitor adapter. Native SDK integration must be implemented and tested per consumer; the existing `/yandex` adapter targets **Yandex Games web**, not Yandex Mobile Ads for Android.

## Banner geometry and reservation

Use [`resolveNativeBannerPlacement`](../layout/NATIVE_BANNER_PLACEMENT.md) for the shared coordinate contract. It returns `hidden`, `reserve` or `place`, with inward pixel rounding, safe-root/WebView containment and parent-padding-adjusted margins. Pass the actual SDK height measured at the same mapped width. The rules below describe integration around that helper; do not implement a second rounding/mapping algorithm in a new consumer.


- Define a real DOM slot in the layout in **both supported orientations**, separated from gameplay controls and system insets. Reserve it before requesting the native banner so load/no-fill cannot unexpectedly shift the board. A bottom slot works in landscape too; compact the game header/controls to recover usable height.
- The empty slot uses the surrounding surface color. Do not leave a contrasting green stripe or placeholder that looks like a broken control. Hide the native view in dialogs, tutorial, background and full-screen ad states; distinguish hiding a view from the explicit product policy for reclaiming its layout slot.
- Compute native placement from the actual slot rect, WebView size and its location relative to the native root. Do not multiply CSS coordinates by device density blindly. The helper uses `scale = webViewWidth / cssViewportWidth`; native root offsets include WebView/root screen positions. Seeds supplies production evidence for the coordinate boundary, while the extracted helper strengthens its validation and rounding. Validate finite positive dimensions and containment within the root on **both axes**.
- Ask the adaptive SDK format for its required height at the actual width. If the reserved slot is too short, report the required **CSS height** to JS, update reservation, remeasure and only then attach/show the native view. Avoid a circular resize/load loop; accept unchanged geometry idempotently and coalesce layout-triggered updates.
- Observe slot resize and native safe-inset changes as well as window resize. On rotation, destroy obsolete ad geometry, invalidate old placement and request current placement after layout settles. Do not allow old callbacks to manipulate a replacement banner.
- Attach/detach SDK views and callbacks on the Android main thread. Remove listeners and destroy obsolete views. Failed loads may retry after a configurable delay and a later eligible action; no immediate callback retry storm. Leave adaptive SDK refresh to the SDK where supported.

Acceptance: portrait → landscape → portrait, rapid repeated rotation, no-fill, failed load, late callbacks, dialog open/close, enlarged fonts, gesture and three-button navigation, cutout, small landscape, ad returning after background. Capture the native screen, not merely DOM bounds. Confirm banner visibility and control non-overlap separately.

## Full-screen ads and earned rewards

- Interstitial opportunities belong to a deliberate user transition after the completed state has saved. Preloading does not authorize showing. A late load callback never opens a full-screen ad by itself.
- Keep first-session grace, interval, retry and rewarded-postponement policies configurable. The kit's [`ActionInterstitialGate`](../platform/INTERSTITIAL_GATE.md) is an eligibility seam, not a durable native cooldown. If cooldown must survive relaunch, implement and test persistence, clock changes and restart semantics in the consumer.
- One full-screen request at a time. Block game input, sound and conflicting navigation while the ad is active. Aggregate independent visibility/native-background/ad blockers with [`GameplayActivityCoordinator`](../platform/GAMEPLAY_ACTIVITY.md): one resume event must not clear another blocker.
- Add a deadline for a missing **pre-show** callback. Do not blindly time out a genuinely displayed ad and resume the game behind it. Resolve/reject pending bridge calls on destruction; discard late callbacks for replaced show sessions.
- Offer rewarded video explicitly. Grant only on the SDK's earned-reward callback; dismissal, request success and impression are insufficient. Display an understandable unavailable state and keep the game usable after failure.
- Persist an earned native receipt before JS delivery. Use the [durable receipt handoff](../platform/DURABLE_RECEIPT_QUEUE.md). Persist game effect and deduplication id before acknowledging native deletion. Test crashes and failures on both sides of that boundary.

## Configuration, analytics and proof

Use separate banner/interstitial/rewarded ids and an explicit test/live build mode. Seeds used `YANDEX_BANNER_AD_UNIT_ID`, `YANDEX_INTERSTITIAL_AD_UNIT_ID`, `YANDEX_REWARDED_AD_UNIT_ID` and `APPMETRICA_API_KEY`. Check required configuration without printing its values. Never bundle a release test hook that selects a mock bridge via a window global.

Track request, load success/error, show, impression, dismissal, show error, earned reward and durable grant as distinct events. Emit game-start on the first meaningful gameplay action, not every screen open; persist attempt start/completion markers when duplicate events matter. Keep raw saves, boards and identifiers used for configuration out of custom event payloads. A test-event flag does not isolate the SDK's automatic test-device audience/session counters.

A signed APK and mocked SDK tests prove neither live fill nor analytics delivery. Verify the native banner, interstitial, rewarded credit, audio/input return and analytics dashboard on a real device. VPN/network differences are diagnostic variables, not proof that unavailable inventory is an application bug. SDK/configuration/disclosure details must be rechecked against current official docs before a new consumer ships.
