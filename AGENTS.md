# Road Lines — instructions for agents

## Read first
1. Read this file and docs/reference-reproduction-plan.md in full before implementation.
2. Read docs/PROJECT_DECISIONS.md, docs/KIT_INTEGRATION.md and docs/IMPLEMENTATION_STATUS.md.
3. Read vendor/mini-games-kit/README.md, then the focused API docs for any reused module.
4. User instructions override this contract. Preserve new decisions here or in the product plan; chat history must not be the only specification.

## Product contract
Build a Fill puzzle closely matching the supplied competitor reference in interaction, composition, animation sequence and reward cadence. First reproduce the baseline, then add new ideas. The goal is a tactile, rewarding game, not merely a solver with coloured cells.
- Keep the full agreed scope: stars, coins, gift progress, themes/catalog, skin offers, daily wheel and ads.
- Make our own title, graphics, icons, audio and puzzles.
- Distinguish observed reference behaviour, explicit v1 choices and unknowns. Do not invent video/audio observations or claim to have inspected unavailable media.
- Our 90-level target is 3 sets of 30, after a polished first 15. Do not inflate to 300 unreviewed levels.
- Do not add modes, backend, profiles, cloud saves, narrative or extra economy before baseline acceptance.

## Stack and boundaries
TypeScript + Phaser + Vite; Android via Capacitor; native Yandex Mobile Ads integration. Portrait v1. Consult current official docs when adding native SDKs or choosing their versions.
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
- npm run test:browser (inspection build: play/pause/result at five viewports)
- node tools/browser-smoke.mjs --production (production build, inspection route excluded)
- npm run android:sync (production web build + deterministic Android generation/sync)
- npm run android:build (JDK 21+, SDK 36; debug APK, not release acceptance)
These currently verify the stage-0 shell and vendored utilities, not a playable puzzle.

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
