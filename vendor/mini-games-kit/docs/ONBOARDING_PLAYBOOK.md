# Event-driven onboarding playbook

This is production guidance, not a universal onboarding engine API.

Signal 2000's first-run work showed that tutorial progression is substantially safer when guidance follows **semantic game events** rather than timers or presentation callbacks.

Examples of good gates:

- durable reward actually committed;
- a resource was actually gained;
- the next control is actually rendered, enabled and settled;
- the player performed the required interaction;
- a persisted first-run grant was confirmed after an ambiguous storage write.

Avoid advancing durable onboarding state merely because an animation ended. Presentation can be skipped, interrupted, restarted or destroyed while gameplay truth remains unchanged.

One-time grants/rewards belong in durable/recoverable state. If a write result is ambiguous, verify persisted state before deciding whether to grant again. The existing `DurablePendingTransactionSession` and JSON repository seams can support this, but the exact onboarding schema and reward policy stay in the game.

Guidance overlays should be restartable and scoped to the currently active scene/surface. A late event from a destroyed scene must not resurrect tutorial UI.

Do not extract a generic `OnboardingEngine` until a second real game demonstrates the same orchestration shape. Preserve this policy now; extract the smallest repeated mechanism later.
