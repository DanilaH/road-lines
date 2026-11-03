# Road Lines — instructions for agents

## Read first
1. Read this file and docs/reference-reproduction-plan.md in full before implementation.
2. Read docs/PROJECT_DECISIONS.md, docs/KIT_INTEGRATION.md and docs/IMPLEMENTATION_STATUS.md.
3. Read vendor/mini-games-kit/README.md, then the focused API docs for any reused module.
4. User instructions override this contract. Preserve new decisions here or in the product plan; chat history must not be the only specification.

## Current monetization contract — approved 2 November 2026
User approved `docs/MONETIZATION_PLAN.md`; it supersedes all earlier monetization numbers/placements and earlier ad deferral. Hint single60 / pack3 for150; one rewarded topup150 from hint/theme shortage; themes500 and existing rewards/free daily wheel unchanged. First interstitial requires60 active seconds AND5 first clears; later90 active seconds AND3 new first clears after the last fullscreen ad closes, including rewarded. Only Continue; protect gifts/final bank result. Banner included with a separate slot and short-screen fallback. No x5/direct theme/extra wheel/IAP in this package. Research cadence10/180/4/150 and cap3 per10min are historical, not approved. Implementation uses GameSave v5, native earned journal and SDK8.6.0; see docs/MONETIZATION_IMPLEMENTATION.md. Automatic debug builds use official demo blocks; never claim live inventory/dashboard/device acceptance from CI. Read the plan before monetization changes.

## Product contract
Build a Fill puzzle closely matching the supplied competitor reference in interaction, composition, animation sequence and reward cadence. First reproduce the baseline, then add new ideas. The goal is a tactile, rewarding game, not merely a solver with coloured cells.
- Keep the full agreed scope: stars, coins, gift progress, themes/catalog, skin offers, daily wheel and ads.
- Make our own title, graphics, icons, audio and puzzles.
- Distinguish observed reference behaviour, explicit v1 choices and unknowns. Do not invent video/audio observations or claim to have inspected unavailable media.
- Our 90-level target is 3 sets of 30, after a polished first 15. Do not inflate to 300 unreviewed levels.
- Do not add modes, backend, profiles, cloud saves, narrative or extra economy before baseline acceptance.

## Stack and boundaries
TypeScript + Phaser + Vite; Android via Capacitor; native Yandex Mobile Ads integration. Portrait locked on Android: user explicitly requires a vertical game without rotation. Keep `android:screenOrientation="portrait"` in deterministic Android generation; game screens and banner layout must not switch to landscape on device rotation. Consult current official docs when adding native SDKs or choosing their versions.
- The kit's Yandex Games web adapter is NOT Android Yandex Mobile Ads.
- Do not replace the agreed stack or pull in the landscape Yandex bootstrap unchanged.
- Pure TS model/solver/economy; Phaser rendering; worker solver; platform seams for ads/storage/audio/haptics/lifecycle/analytics.
- Pin dependencies and commit lockfiles. Phaser/API compatibility is verified at scaffold time; do not assume Phaser 3 and 4 APIs are interchangeable.
- No generic framework or speculative dependency injection layers. Keep project rules and tuning local.
- vendor/mini-games-kit is a selected, pinned source snapshot, not the entire upstream package. Import individual files; no npm dependency on moving main or unmerged branch.
- Read the manifest before updating vendor. Record exact upstream commit, modifications and matching tests. Do not casually edit vendor internals to hold Road Lines policy.
- No sub-agents unless the user explicitly requests them.

## Interaction acceptance
- Fixed start; orthogonal path; each available cell visited once; accept ANY legal complete path.
- Filled cells plus connectors form one thick continuous ribbon. Draw connectors only between consecutive path neighbours. Keep the light dotted route.
- Start marker stays at start; endpoint is clear. Do not move the start marker with the head.
- Fast segment-based input must not skip cells; support sequential reverse undo, release/resume, pointer capture and cancellation.
- Never teleport to an old cell or smooth a route across holes/walls. Invalid gestures do not erase progress.
- Undo/reset are free. Pause, background, second pointer and ads do not destroy the path.
- Hint search uses the actual prefix. FOUND, UNSOLVABLE and UNKNOWN are distinct. Timeouts are not proof of dead ends; never charge for an unusable hint.

- Optional finish/walls/ordered-checkpoint rules are specified in docs/MECHANICS.md. Apply them consistently to input, solver, completion and restore; retain all original 15 IDs/versions. Current bank: 90 in three sets of 30; preserve original records except the explicitly approved numbered-intro revision below. New sets unlock after three tutorials, independently; Continue advances across set boundaries in bank order; only the final bank level returns to selection.

## Presentation acceptance
- Reference composition: free space, compact top controls, square grey cells with gaps, theme-coloured ribbon. Scale by figure bounds with a sensible maximum cell size.
- New board: small grey squares grow, then the coloured start opens.
- Win: complete ribbon → brief expansion → souvenir miniature → title and three staged stars → reward/gift UI → multi-burst confetti → coin scatter/collection → next board.
- Confetti spans the viewport, not the board container. Include long ribbons and varied small particles; text/buttons remain legible above it.
- Continue is available before effects finish. Double tap, skip and interruption cannot lose or duplicate rewards.
- Currency presentation counts on arrivals, but durable reward ownership never depends on tween/audio callbacks.
- Cell sounds, reverse cue, completion, staged stars, coin arrivals and gifts need intentional sound design. Limit cue rate/polyphony under fast swipes.
- Haptics must be perceptible on a physical Android device, independently configurable from sound. Browser support is not evidence of native quality.
- Palette and timing can be close to the reference without borrowing its asset files.

## Persistence and earned rewards
- One coordinated writer owns the save key. Codecs validate/migrate; repair only deterministic transient inconsistencies, never guess currency or pending outcomes.
- Full ordinary snapshots may use RevisionSnapshotQueue. Transactions, receipts and acknowledgements MUST NOT be coalesced.
- Before receipt commit: quiesce ordinary producers, settle writes, load authoritative state, atomically persist effect + processed receipt id, rebase producer state/epoch, then ack exact native receipt.
- A stale autosave must never overwrite a grant. A disk-I/O Promise chain alone does not establish this.
- Native earned receipt is persisted BEFORE JS notification. SDK event, final result and startup recovery go through one handoff.
- Validate receipt target/placement/session/version; do not redirect a late x5 or theme reward to the currently visible result.
- Keep externally earned receipts pending until the reward is durably established. Ambiguous write + failed authoritative reload blocks mutation until recovery.
- Pending local wheel result is fixed before animation; restart never rerolls or double-grants.
- Persist first-clear, base reward and gift progress together. Animation balance is separate from authoritative balance.
- No broad loadOrDefault reset on valuable-save parse error.

## Ads and lifecycle
- Banner slot: play, pause, stage grid; no banner on result/theme offer/wheel/fullscreen ad. Road Lines explicitly keeps banner visible in pause, unlike the generic modal advice.
- Use resolveNativeBannerPlacement and SDK-measured height; distinguish CSS px, native px and SDK dp. Reserve/remeasure before showing.
- Interstitial only after user Continue and saved completion, before the next board. Enforce grace, minimum new completions, shared fullscreen cooldown, no stacking after rewarded/gift/skin offer.
- ActionInterstitialGate is only a request gate. It does not implement reward postponement, persistent cooldown or the entire product policy.
- One fullscreen request at a time. Missing pre-show callback can time out; a genuinely displayed ad must not resume the game behind it.
- Grant only from an earned callback/receipt, never from dismiss, impression or request success.
- Aggregate ad, visibility, native background and modal blockers. Clearing one cannot resume input/audio while another remains.
- Every observer/listener/timer/worker/native ad view has deterministic cleanup. Ignore stale callbacks using session/generation identity.
- Browser mocks are development-only and cannot be selected through release globals.

## Work sequence
Follow the stages in the product plan:
0. Scaffold, Android shell and reference static screens.
1. Input/model/solver/persistence + first 15 puzzles.
2. Full win/reward/next cycle with audio/haptics: first playable acceptance build.
3. Menus, progression, themes and wheel.
4. Native ads and lifecycle.
5. 90 puzzles, RU/EN, performance and release acceptance.
6. Reference comparison, then enhancements.
Update docs/IMPLEMENTATION_STATUS.md when a stage changes. Do not call the whole game ready after completing one stage.

## Verification and reporting
Baseline commands:
- npm ci
- npm run check (manifest integrity + application/kit TS + copied kit regression tests)
- npm run test:browser (inspection build: five viewports plus all 90 puzzles via actual pointer input)
- node tools/browser-smoke.mjs --production (production build, inspection route excluded)
- npm run android:sync (production web build + deterministic Android generation/sync)
- npm run android:build (JDK 21+, SDK 36; debug APK, not release acceptance)
The stage-1 puzzle is playable. Kit tests, game tests, content validation and browser input flows are separate evidence; no physical-device acceptance is implied.

When adding the application, add and run actual app build and relevant model/flow checks. Test meaningful invariants and failure boundaries, not implementation-mirroring trivial tests.
- Route legality/undo/alternative solutions; independent content validator; worker cancellation/stale hints.
- First-clear/x5/purchase/gift/wheel idempotence, stale snapshot vs grant, save/ack failure and restart.
- Built UI at 360×800, 390×844, 412×915 plus short screen/safe insets/font scaling.
- Physical Android: fast finger input, haptics, sound, banner, earned rewarded, Back/background/process death.
- RU/EN rendered copy, number forms and overflow. Authentic screenshots come from the current renderer/build; mockups are not gameplay evidence.
- Separate compilation, automated tests, browser visual review, native integration, signed build and publishing. Record commands, source revision, artifact hash and limitations.
- Never claim device quality/live fill/dashboard delivery from mocks or CI.
- Do not ask for routine confirmation to continue already authorised reversible work. Ask only for genuinely missing essential information.
- Final updates state what changed, what passed and what remains unverified. Keep them concise.



## Languages and first-gesture coaching
- All UI/error/ARIA text and theme/set/chapter names come from typed src/i18n.ts. Keep RU and EN complete, including dynamic number forms. Native option names Русский / English intentionally retain their own lang attributes.
- Russian is the compatibility default. Explicit language choice is a noncritical preference in road-lines.locale.v1; never put it in the valuable game snapshot or mutate economy/progression when translating UI.
- Language switches preserve confirmed hint/rollback and their semantic messages; keep asynchronous revision/cancellation guards. No renderer recreation or extra frame loop for localization.
- Intro 1–3 coaching is session-only and nonblocking in the existing instruction line. Completion never requires demonstrating a gesture. Preserve existing level IDs/versions and free undo/reset.
- Run node tools/localization-smoke.mjs --run for language/layout/gesture/persistence changes. Its default checks the complete matrix; --rules-only only repeats the rule-caption tail on an already validated unchanged runtime.

## Persistence faults and soak verification
- For save/wheel/reward/ownership changes, run `node tools/persistence-smoke.mjs` and the fault matrix in `tests/persistence-faults.test.ts`; keep old-or-new snapshots, restart idempotence and stale-writer protection.
- Long diagnostic runs: performance-audit `--long-soak`, then `--supplement`, then `node tools/verify-soak.mjs`; `node tools/large-board-soak.mjs` adds repeated large-prefix pointer input and paused resize/menu cycles. Prepare the private probe first; never ship its globals.
- Resource budgets and warmup plateaus are bounded evidence, not proof of zero leaks or phone FPS/heat. AudioContext closure and oscillator ended-event counts are different observations. Preserve failure diagnostics; do not call a non-reproduced CI timeout fixed.

## Analytics and startup readiness
- Typed events/attempt counters live in `src/services/analytics.ts`; native transport in `src/platform/analytics.ts` and `native/android`. Never gate saves, grants, input or boot on analytics delivery. No per-cell/per-frame events, raw paths/saves/errors or separate telemetry storage/outbox.
- Completion/hint debit/purchase/wheel events follow confirmed durable mutations. Restored results do not replay completions; resumed attempts and active time exclude aggregate blockers. Selecting the already equipped theme is not another selection.
- Web production is no-op. Diagnostic console capture exists only in the explicit `analytics-test` compile mode. Android SDK activation requires generated native API-key configuration; never put it in Vite variables or commit generated key assets. Debug CI uses `APPMETRICA_DEBUG_API_KEY`; missing key is disabled, not proof of live delivery.
- Run `node tools/analytics-smoke.mjs`, `node tools/reload-touch-smoke.mjs` and localization smoke after lifecycle/analytics wiring changes. Readiness means the uncovered UI crossed a paint boundary; do not set ready in the callback that removes startup cover.
- Chromium intentional-crash CI runs on Ubuntu 22.04 because upstream Playwright documents a missing crash event on Ubuntu 24.04. Preserve actual crash assertions rather than replacing them with reload/skip; distinguish local evidence, native compilation and dashboard/device acceptance.

## Approved physical-playtest changes — 2 November 2026
- User approved all seven findings: richer sampled sound, global arc-length route dots, screen-wide directional input, optional result theme preview/purchase, finish at last number in first numbered lessons, continuous bank progression, reset/hint thumb controls below board.
- Preserve IDs, original first 15, earned progress/wallet/ownership. Numbered intro edits must bump level version and repair only old transient drafts. Historical immutable-30 rule is explicitly superseded for these lessons; retain an independent baseline check with an allowlist, not a blind hash update.
- Absolute input near the route remains supported. A gesture can steer from surrounding play space and continue beyond figure/board; buttons/modals/banner never initiate route input. No teleport across walls/holes; model guards and sequential reverse always apply. Background/pointercancel/resize retain prefix.
- Theme preview on result is session-only and free. Purchase remains explicit and atomic; Continue stays available, preview never grants ownership or changes saved equipment. Ads stay deferred.

- Thumb controls activate completed primary touch/pen on release inside their original button. Cancel/drag away must not activate; consume only the later compatibility click, keep mouse/keyboard/assistive activation and deterministic listener cleanup. Test a swipe ending over the dock followed immediately by one reset tap, with exactly one action.
- Android CI produces a side-by-side `.playtest` debug package, not an in-place migration of previously random-signed APKs. Its explicit debug signing file is `.test-output/android-signing/debug.keystore`, cached in CI; default sync without ROAD_LINES_PLAYTEST keeps the normal ID. No generated keys enter git; debug cache is not release signing.

## Approved rewards/feedback pass — 2 November 2026
- Broader sampled timbres, bounded melodic pitch and no immediate strike repeats; stronger distinct native haptics with duty/priority limits. Keep one audio buffer/context and no queued stale feedback after background.
- Result candidates rotate among unowned themes, prioritizing affordability. Preview stays free; show shortage upfront and never open a disabled purchase confirmation from it. Suggestion preference is noncritical and separate from the valuable save.
- Eight equal wheel sectors remain transparent: sector 7 can grant a fixed unowned paid theme (1/8); all-owned or a subsequently acquired duplicate pays 300 coins. Stage the exact theme before animation; no reroll or repeated ownership grant. Legacy numeric sector 7 remains 300. Save v4 migrates v1–v3 without resetting earnings; older clients must reject v4 rather than misinterpret a themed pending award.
- Gift is an interruptible opening celebration. Its coins already belong to the first-clear transaction; animation/skip/Back/reload only acknowledge presentation. Allow its feedback under its own UI blocker, while ANY background, pause, ad, startup or save-conflict blocker still stops sound/haptics/effects, including changes without an aggregate activity edge.
- Hints-for-coins and rewarded coin topups belong to the later monetization pass. No ad SDK/placement or hint price changes in this pass. Run celebrations smoke plus persistence, localization and analytics checks for these changes.

## Gift artwork correction — 2 November 2026
- User rejected the flat SVG replacement. GiftReveal must use original gift.webp for the literal lid/bow and outside/front faces, split with SVG clips. The reference-derived gift-interior.webp supplies hidden rear walls/floor behind them. All four walls and depth must remain visible when open.
- Light originates in the aperture, occluded by front faces. Two bounded bright confetti bursts include chips/circles/ribbons; keep title/value/Continue legible. Reduced motion, skip/background/resize/dispose settle and remove particles/timers.


## Startup and optional native ads
- Native ad init/listener/status cannot gate core lifecycle installation or the first visible frame. Receipt queries, network errors and ack failures must never block Play, route input, Back, menus or Continue. Recover in the background with bounded backoff and one outstanding native RPC per operation; preserve pending receipts. Settle the latest prefix and atomically grant+ledger synchronously only when a validated receipt arrives, then ack without holding a gameplay gate. Genuine ambiguous save I/O retains its separate recovery protection. Do not clear pending receipts or guess rewards on timeout.
- Do not sleep the renderer before its first postrender when readiness depends on that event. Run `node tools/startup-ads-smoke.mjs` for startup/native timing changes, including never-resolving status and delayed/pending receipt calls.

## Ad failure policy — user correction 3 November 2026
- No ad-receipt/ad-recovery-error activity blockers or mandatory retry dialogs. No receipt query may cancel a gesture or hint search. Ad unavailability does not require internet to play. Late rewards rebase on the latest synchronous GameStore state; only actual save conflicts/ambiguous storage failures may protect valuable mutations. Missing callbacks must not accumulate native RPCs.
