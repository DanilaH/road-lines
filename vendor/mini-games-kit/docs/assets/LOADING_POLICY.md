# Runtime asset loading policy

This is production guidance rather than a universal loader API. Different games legitimately choose different points on the startup-vs-runtime-loading tradeoff.

## Classify assets by interaction contract

Before choosing loader mechanics, classify runtime assets by when the player can reach them:

- **startup-required** — the first usable frame cannot be correct without them;
- **session-required** — any normal interaction in the current session can expose them without an explicit loading transition;
- **deferred/optional** — the product has an authored loading boundary before they are needed, or they are genuinely optional enhancement/fallback content.

The classification is semantic. Do not infer it merely from which scene currently references a file.

## Small instant-play games

For a compact game where all session content is immediately reachable, preloading the reviewed session-required set before semantic Game Ready can be preferable to hidden runtime fetch/decode stalls. In that mode, post-ready `ensure*` functions should be assertions/readiness checks, not covert loader entry points.

Signal 2000 eventually adopted this contract after staged lazy loading introduced exactly the class of UX risk it wanted to avoid. That is evidence for this shape in similar small games, **not** a universal ban on runtime loading.

## Larger or naturally segmented games

Runtime loading is appropriate when the product already has a meaningful boundary: level transition, world travel, explicit content selection, streaming corridor, or another state where loading is expected and authored. The kit's Phaser runtime image loader remains available for that case.

The important rule is that network/decode work must not appear as an accidental hitch after the UI has promised immediate availability.

## What to verify

For the chosen policy, make the contract testable:

1. enumerate the asset set behind the first usable frame;
2. enumerate content that is reachable without an authored loading boundary;
3. ensure every such asset is ready before its interaction can expose it;
4. if the project claims zero post-ready loading, instrument or assert that no image loader/network path starts after Game Ready;
5. test cold-host behavior, not only warm local cache;
6. preserve procedural/fallback rendering only when it is an intentional product behavior, not a way to hide missing authored art.

Do not optimize startup bytes by moving work past Game Ready unless the resulting loading boundary is a deliberate UX decision. That merely moves latency from a measured startup wall into player interaction.
