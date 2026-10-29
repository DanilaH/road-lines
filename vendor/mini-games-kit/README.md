# Selected mini-games-kit snapshot

Source: DanilaH/mini-games-kit. Exact revisions and per-file provenance: [manifest.json](manifest.json).
Main: 5450f9db344aacb5acdc103b4199fd8aeb11b10d; Seeds extraction: d4dee18c9b466e2b4a68d8d481db6dfc50ec9ee5 (unmerged branch snapshot).

This directory contains selected code, regression tests and focused docs, not the entire npm package. Source/test bytes are unchanged except the two local platform/layout barrel indexes. Omitted documentation targets point to pinned upstream. LICENSE-NOTICE.md is retained; no new licence grant is asserted.

## Local imports
Import individual files, for example:
```ts
import { DurableReceiptQueue } from './vendor/mini-games-kit/src/platform/durable-receipt-queue';
```
Adjust the relative prefix from the caller. Focused docs retain upstream @danilah/mini-games-kit import examples; those package paths are not installed here.

## API entry points
- [Pending transactions](docs/core/DURABLE_PENDING_TRANSACTION.md), [receipt handoff](docs/platform/DURABLE_RECEIPT_QUEUE.md), [snapshot saves](docs/platform/REVISION_SNAPSHOT_QUEUE.md), [JSON repository](docs/platform/JSON_REPOSITORY.md).
- [Activity](docs/platform/GAMEPLAY_ACTIVITY.md), [interstitial request gate](docs/platform/INTERSTITIAL_GATE.md), [banner geometry](docs/layout/NATIVE_BANNER_PLACEMENT.md).
- [Coin transfer](docs/core/VALUE_TRANSFER.md), [presentation skip](docs/core/PRESENTATION_SKIP.md), [pitch](docs/audio/PITCH.md), [audio lifecycle](docs/audio/PRESENTATION_MIXER.md).
- [Viewport](docs/layout/VIEWPORT_RUNTIME.md), [startup](docs/startup/STARTUP_RUNTIME.md).
- [Android SDK recipe](docs/android/ADS_AND_LIFECYCLE.md), [Android release acceptance](docs/ANDROID_RELEASE_ACCEPTANCE.md), [localisation/store media](docs/LOCALIZATION_AND_STORE_MEDIA.md).

## Important limits
- Native SDK adapter, durable native receipt journal, game codec/writer, input/solver, graphics and haptics are not supplied.
- Do not use landscape sizing/default portrait blocker for Road Lines.
- Snapshot queue is not a transaction boundary. Read the receipt+snapshot handoff recipe.
- Audio mixer/noise are opt-in utilities; do not add music just to use them.
- Provenance does not establish integration/device evidence.
- Run npm run check at the repository root; see docs/KIT_INTEGRATION.md for application decisions.
