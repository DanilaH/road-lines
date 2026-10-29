# Android release and independent acceptance

Production checklist from [Seeds](https://github.com/DanilaH/mini-games-kit/blob/d4dee18c9b466e2b4a68d8d481db6dfc50ec9ee5/docs/SEEDS_EXTRACTION.md). It supplements, rather than replaces, platform-specific documentation. An item is only passed when its evidence is recorded; this document is not evidence that a future consumer has passed it.

## Reproducible build and size

Keep native customizations in versioned source/templates installed deterministically into generated Capacitor projects. Do not hand-edit ignored generated Android files and expect CI to reproduce them. Pin dependencies, record source revision and fail clearly when required integration configuration is absent.

Measure the actual signed release APK and its contents before optimizing. Distinguish APK size, download compression, installed size and runtime memory. Enable release code/resource shrinking with precise keep rules for reflection/bridge entry points. Retain SDK notices and mapping files; do not remove functional SDK components or device support just to reach an arbitrary size. Seeds reached a roughly 5.5 MB signed APK; that is evidence from one project, not a budget for every game.

After shrinking, check native bridge registration, reflective calls, WebView assets, startup, saved state and all ad paths on the release payload. A debug build passing tests does not verify R8 output. Keep stable package id and signing identity, monotonic store versionCode, human-readable versionName, public certificate fingerprint and SHA-256 of the **delivered** APK. Preserve the signing key privately; never commit it or put it in a store-media ZIP.

## Independent test layers

| Layer | What to challenge | What passing cannot establish |
| --- | --- | --- |
| Pure model / independent oracle | Legal actions, undo, additions, resets, all catalog witnesses, invalid dates, numeric bounds and corrupted saves | UI clarity, enjoyable difficulty, native SDK behavior |
| Production-browser tests | Actual built UI, large boards, portrait/landscape, font scaling, dark mode, repeated inputs, navigation, storage failures and conflicting tabs | Native placement, real ads, signing, R8 |
| Controlled native bridge harness | Duplicate/late callbacks, stale sessions, reward save/ack failure, pre-show timeout, view recreation | Actual SDK inventory and device integration |
| Release-payload Android emulator | Native/WebView startup, Back, rotation, state restore, bridge availability, native banner geometry | All physical devices, live dashboard delivery or guaranteed network isolation |
| Physical device / live integration | Earned credit, interstitial return, visible banner, audio focus/background and dashboard events | Exhaustive absence of defects |

Do not reuse the same algorithm as both generator and independent oracle. Re-run affected failure cases after a fix, then the appropriate regression set; repeated green broad runs do not close an untested finding. Record known failures and limitations even when an aggregate workflow is green. Diagnostic continue-on-error steps are useful for collecting evidence but must not silently make failed acceptance pass.

Exercise these interruption boundaries: before save, while save is pending, after durable save but before acknowledgement, after ack, during animation, while an ad is pending, while an ad is shown, rotation and process restart. Verify both the saved truth and the visible state after returning.

For competing tabs, change different settings nearly simultaneously while a tab is backgrounded, and concurrently perform gameplay actions. Detect stale saves and choose an explicit conflict policy. A lock with a stale in-memory merge can still lose preferences. Test with recorded reads/writes; bringing every tab to the foreground can hide the race.

Keep release acceptance tied to an explicit source run/artifact id and expected hash; a stale default can accidentally test an older APK. Mark whether emulator signing uses a temporary test identity or the actual production certificate. If claiming offline isolation, verify network blocking: removing Wi-Fi or toggling airplane mode alone may leave emulator connectivity or cached ads.

## Evidence and release bundle

Record source and build revision, commands, per-layer results, environment, APK version/size/hash/certificate, test/live mode and unresolved findings. Keep raw configuration values and private signing material out of logs and public bundles. Distinguish successful compilation, automated verification, device verification, moderation submission, approval and public availability.

Build public store assets separately: icon, representative phone/tablet screenshots, descriptions, disclosures and upload instructions. Follow the [store-media playbook](LOCALIZATION_AND_STORE_MEDIA.md). SDK declarations and storefront limits must match the current integration and current storefront requirements; copying a disclosure checklist from another app is insufficient.
