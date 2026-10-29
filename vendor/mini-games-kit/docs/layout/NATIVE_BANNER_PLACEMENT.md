# Native banner placement geometry

Import `resolveNativeBannerPlacement` and its types from `@danilah/mini-games-kit/layout`. Pure TypeScript, no Android/Capacitor/DOM dependency. This is tested geometry, **not a bundled advertising SDK adapter**.

## Contract

```ts
import { resolveNativeBannerPlacement } from '@danilah/mini-games-kit/layout';

const result = resolveNativeBannerPlacement({
  slot: { x: 0, y: 750, width: 390, height: 60 }, // CSS viewport px
  viewport: { width: 390, height: 844 },
  webView: { x: 0, y: 24, width: 780, height: 1688 }, // native px, root-relative
  root: { width: 780, height: 1736 },
  parentPadding: { left: 0, top: 24 }, // native px
  adHeight: 100, // SDK measurement in native px at the mapped width
});

if (result.kind === 'reserve') {
  // Set DOM slot height to result.heightCss; then remeasure before showing.
} else if (result.kind === 'place') {
  // Native adapter applies result.rect size and marginLeft/marginTop.
} else {
  // Hide native banner; inspect result.reason for diagnostics.
}
```

Input slot comes from getBoundingClientRect in the same coordinate space as viewport. Native WebView origin is its location on screen minus root location on screen. Uniform CSS→native scale is WebView width / CSS viewport width; do not substitute devicePixelRatio or Android density. Native density remains relevant only when calling an SDK API that asks for dp.

Map inward to whole native pixels:
- left = ceil(webView.x + slot.x × scale)
- right = floor(webView.x + (slot.x + slot.width) × scale)
- mapped width = right - left

Measure SDK height using **that same mapped width** before calling this utility. `adHeight` must describe the current orientation/width, not a previously loaded banner. Native px, CSS px and SDK dp must not be mixed. Top/bottom use the same inward rounding; SDK height rounds up, and placement is vertically centered within the slot.

Optional `safeInsets` exclude root areas on all four sides. These are actual forbidden areas; `parentPadding` only adjusts FrameLayout margins and is not itself an exclusion. Parent-relative margins can be negative if padding has already been accounted for in the physical placement.

Output:
- `hidden`: invalid/nonfinite/zero geometry, out-of-viewport slot, mapped slot outside WebView/safe root, or below explicit `minWidth` (native px). No arbitrary screen-height or orientation restriction.
- `reserve`: slot is otherwise valid but too short; returns whole CSS height accounting for edge rounding and mapped native width. Reservation is not permission to show. Re-layout may move the slot or reveal it no longer fits.
- `place`: rect fits within current slot, WebView and safe root; returns rect and margins. No clipping to hide layout defects.

## Consumer lifecycle

Observe slot resize, viewport resize, scroll, native offsets/insets and orientation. Coalesce measurements. Tag async SDK requests with a generation; discard obsolete callbacks after rotation, navigation or destruction. Never let late callbacks show a banner for an old slot. If reservation cannot fit, keep the native view hidden and change the layout; never crop the board. Tear down observers and hide/destroy the SDK view on disposal. Parent transforms, pinch zoom and visual/layout viewport differences require explicit coordinate normalization by the consumer; this function cannot discover them.

Keep the same neutral slot surface through loading/no fill. Retry timing, minimum SDK width, ad visibility during modals/background/fullscreen ads and whether to reclaim empty space are consumer policies. The helper does not load ads, choose orientation, enforce ad-network policy or guarantee touch comfort.

## Provenance and validation

Source: Sudoku Doku 0.17 native banner placement (`DokuNativePlugin.java`, `BannerPlacement.java`) and DOM slot reservation (`App.tsx`), revision `f97cc1ed1c32e7d2f438fbaea6671530b1a5fc59`.

Strengthened extraction: finite input checks, both-axis containment, explicit safe bounds, inward rounding and deterministic reservation feedback. Native source did not provide all these guarantees. Tests cover portrait, short landscape, offsets/padding, SDK height negotiation, fractional rounding, invalid geometry and both-axis containment. These TypeScript tests do not replace a real Android SDK orientation test; the source 0.17 had real demo-banner evidence, this newly extracted helper has not been wired into a native release yet.
