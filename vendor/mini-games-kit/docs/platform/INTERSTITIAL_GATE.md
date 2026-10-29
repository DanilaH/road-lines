# `ActionInterstitialGate`

Import from `@danilah/mini-games-kit/platform`.

## What it is

A pure local eligibility gate for interstitial **requests**. It combines initial grace time, minimum time between requests and a minimum number of meaningful user actions.

## Public API

```ts
const gate = new ActionInterstitialGate(() => performance.now(), {
  initialGraceMs: 180_000,
  minIntervalMs: 180_000,
  minActionsBetweenRequests: 4,
});

gate.markReady();

if (gate.recordEligibleAction()) {
  void ads.showInterstitial();
}
```

Call `recordEligibleAction()` synchronously from a real user-driven transition such as collect, level end or run completion when the platform requires user-action proximity.

## Important behavior

Eligibility is consumed when the request is made, not only when an impression succeeds. If the ad platform throttles/errors/no-fills, the client still waits for the next full cooldown instead of hammering the SDK every action.

## Non-goals

The gate does not know analytics event names and does not call an ad SDK. Platform rules and trigger choice stay with the game.
