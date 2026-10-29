import { describe, expect, it } from 'vitest';

import { ActionInterstitialGate } from '../src/platform/index';

describe('ActionInterstitialGate', () => {
  it('requires both grace time and enough eligible actions', () => {
    let now = 0;
    const gate = new ActionInterstitialGate(() => now, {
      initialGraceMs: 180_000,
      minIntervalMs: 180_000,
      minActionsBetweenRequests: 4,
    });
    gate.markReady();
    for (let index = 0; index < 12; index += 1) expect(gate.recordEligibleAction()).toBe(false);
    now = 180_000;
    expect(gate.recordEligibleAction()).toBe(true);
  });

  it('consumes local eligibility on request rather than on successful impression', () => {
    let now = 100;
    const gate = new ActionInterstitialGate(() => now, {
      initialGraceMs: 0,
      minIntervalMs: 1_000,
      minActionsBetweenRequests: 2,
    });
    gate.markReady();
    expect(gate.recordEligibleAction()).toBe(false);
    expect(gate.recordEligibleAction()).toBe(true);
    expect(gate.recordEligibleAction()).toBe(false);
    now += 1_000;
    expect(gate.recordEligibleAction()).toBe(true);
  });
});
