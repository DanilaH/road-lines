# Localization and authentic store-media playbook

Production checklist for small, reward-driven games. This is **guidance, not a new kit runtime API**. Apply it alongside the [hosted Yandex DRAFT playbook](https://github.com/DanilaH/mini-games-kit/blob/5450f9db344aacb5acdc103b4199fd8aeb11b10d/docs/yandex/DRAFT_RELEASE_PLAYBOOK.md); CI and correct dictionary keys do not establish that localized gameplay reads naturally or that store assets represent the shipped game.

## 1. Localize player meaning, not source-language tokens

Translate a mechanic's *player-facing event* in its actual UI context, not its internal identifier or a dictionary entry in isolation. A literal translation can be grammatically possible and still describe the wrong thing. For an empty collection, describe what the player can actually do (find an item by opening a pack), rather than instructing them to open the item itself. Check that buttons name their destination/action, milestones communicate what was accomplished, and reward copy explains what was earned.

Keep the project's lore, tone, object names and reward vocabulary in the consumer. Avoid importing Signal 2000's `CHIPS`, `Hidden Pocket`, rarity tiers or wording as generic kit policy.

Review complete rendered strings in **both** supported languages across the actual player path, including: startup/first run; pack selection and price; opening interaction; common and premium result; duplicate conversion; secret/extra reveal; milestone; empty, partial and full collection; error/recovery and return navigation. Rare states may be reached with deterministic fixture saves or a dedicated capture/debug build, but verify the UI against the actual game runtime.

## 2. Compose dynamic copy semantically

- A standalone resource heading is not an amount. `CHIPS` may work as a HUD heading but must not be pasted after every number. Inflect counted nouns through a tested project/locale formatter; for Russian include `0, 1, 2, 4, 5, 11–14, 21, 22, 25, 101, 111` and amounts actually used in the game. Check prices, progress, bonuses, animated counters and duplicates, not just static labels.
- A self-contained rarity badge and an adjective in a phrase may require **different text**. Verify each in context with object names of different grammatical genders; do not solve one mismatch by changing every label globally.
- Keep semantic reward categories distinct: a new item, a duplicate, an extra secret, and a bonus resource are different events. The presentation string must not change reward resolution, economy arithmetic, persistence or RNG.
- Test functions against representative edge values; supplement unit tests with real rendered-language acceptance. A dictionary parity test alone cannot detect meaning, declension, text overflow or an instruction that names the wrong action.

A small consumer-local formatting function and explicit copy variants are preferable to a speculative universal localization engine. Extract an optional locale-agnostic formatter seam into the kit only after another real game demonstrates the same boundary; language rules, domain nouns and tone remain with the consumer.

## 3. Store screenshots must be authentic, representative and independently reviewed

Capture screenshots **directly from the running game renderer at the intended build/revision and language**. Do not substitute AI-generated art, manually reconstructed UI, or attractive mockups and call them gameplay screenshots. Video-frame extraction is authentic but may not cover the selling states; record those states separately rather than pretending an early-run video contains them. Maintain provenance (game revision/build, locale, resolution, capture method and any fixture/debug setup) outside the screenshot.

Before recording, make a simple per-locale shot inventory suited to the actual game. For a reward/collection loop, likely candidates are: unopened pack, opening gesture, revealed ordinary item, high-rarity result, secret/extra result, and a populated collection. Do **not** let the gallery become six nearly identical collection screens. Select varied frames that communicate input → reveal → reward → progression, not only attractive UI.

An authored test save or debug forcing of a rare result is acceptable for reproducible **in-engine staging**, provided the depicted state can occur in the product, the shipped renderer and correct assets are used, and the result is never represented as an organic random drop or an unmodified playthrough. Keep developer controls, fake balances, debug overlays and unrelated browser chrome out of candidate screenshots; never edit the text or gameplay result after capture and then describe it as a raw screenshot. Store art/illustrations, if permitted by the target storefront, must be explicitly distinguished from gameplay captures.

Capture RU and EN **separately** (do not translate pixels), inspect each full-resolution image for clipping, font fallback, stale text, incorrect locale, hidden/overlapping UI, missing art and misleading composition. Choose the final image order only after reviewing the full candidate pool on desktop and mobile-size thumbnails. Re-capture affected shots after any relevant code, text or asset change; a previously approved screenshot is not evidence of the latest build.

## 4. Minimal release acceptance record

For each supported language, record:

1. Gameplay text reviewed in the real result/collection flow, including number edge cases, grammatical gender, rare rewards and an error/recovery state.
2. Screenshot inventory with more than one gameplay phase; the final shortlist includes a visible reveal and is not dominated by collection screens.
3. Exact source revision, target resolution, language, capture provenance and whether any rare state was deliberately staged in-engine.
4. A clear distinction among **code merged**, **CI passed**, **hosted build deployed**, **store/DRAFT archive uploaded**, and **screenshots approved**. None implies the others.

Do not claim a hosted, visual or store check passed if only CI was run. The final artifact should use the latest shipped-game wording; generated marketing art must never silently replace in-game evidence.

## Provenance and extraction boundary

These lessons came from [Signal 2000's Russian Hidden Pocket copy correction (#191)](https://github.com/DanilaH/cases-yg/pull/191), [follow-up localization fixes and regression tests (#194)](https://github.com/DanilaH/cases-yg/pull/194), and the accompanying RU/EN screenshot-selection work. The source experience revealed both literal-translation pitfalls and how easily synthetic artwork or repetitive collection captures can be mistaken for useful store screenshots. This document preserves the **review and provenance method**, not Signal-specific content or implementation. No new public API or localization dependency is introduced.
