import { describe, expect, it } from 'vitest';

import {
  createValueTransferPlan,
  shouldPlayValueTransferCue,
  valueAfterVisualArrival,
  valueTransferEmissionDelay,
  valueTransferProgress,
} from '../src/core/value-transfer';

describe('value transfer planning', () => {
  it('can preserve Signal 2000 one-unit-per-token behavior when explicitly requested', () => {
    const plan = createValueTransferPlan(150, {
      minDurationMs: 320,
      maxDurationMs: 900,
      maxVisualTokens: 150,
      maxAudioEvents: 36,
    });

    expect(plan.semanticAmount).toBe(150);
    expect(plan.visualTokenCount).toBe(150);
    expect(plan.durationMs).toBe(900);
    expect(plan.flightDurationMs).toBe(225);
    expect(valueTransferEmissionDelay(plan, 0)).toBe(0);
    expect(valueTransferEmissionDelay(plan, 149)).toBeCloseTo(plan.emissionWindowMs);
    expect(valueAfterVisualArrival(plan, 0)).toBe(1);
    expect(valueAfterVisualArrival(plan, 149)).toBe(150);
    const cueCount = Array.from({ length: plan.visualTokenCount }, (_, index) =>
      shouldPlayValueTransferCue(plan, index),
    ).filter(Boolean).length;
    expect(cueCount).toBeLessThanOrEqual(37);
  });

  it('decouples large semantic rewards from visual object count', () => {
    const plan = createValueTransferPlan(5000, {
      minDurationMs: 320,
      maxDurationMs: 900,
      maxVisualTokens: 18,
      maxAudioEvents: 12,
    });

    expect(plan.semanticAmount).toBe(5000);
    expect(plan.visualTokenCount).toBe(18);
    expect(valueAfterVisualArrival(plan, 0)).toBe(277);
    expect(valueAfterVisualArrival(plan, 17)).toBe(5000);
    expect(valueTransferProgress(plan, 17)).toBe(1);
    const cueCount = Array.from({ length: plan.visualTokenCount }, (_, index) =>
      shouldPlayValueTransferCue(plan, index),
    ).filter(Boolean).length;
    expect(cueCount).toBeLessThanOrEqual(12);
  });

  it('keeps timing bounded and monotonically scheduled', () => {
    const plan = createValueTransferPlan(33, {
      minDurationMs: 320,
      maxDurationMs: 900,
      maxVisualTokens: 33,
    });
    const delays = Array.from({ length: plan.visualTokenCount }, (_, index) =>
      valueTransferEmissionDelay(plan, index),
    );

    expect(plan.durationMs).toBeGreaterThanOrEqual(320);
    expect(plan.durationMs).toBeLessThanOrEqual(900);
    expect(delays[0]).toBe(0);
    expect(delays.at(-1)).toBeCloseTo(plan.emissionWindowMs);
    for (let index = 1; index < delays.length; index += 1) {
      expect(delays[index]!).toBeGreaterThanOrEqual(delays[index - 1]!);
    }
  });

  it('normalizes invalid and fractional amounts safely', () => {
    expect(createValueTransferPlan(-5, { minDurationMs: 0, maxDurationMs: 500 }).semanticAmount).toBe(0);
    expect(createValueTransferPlan(7.9, { minDurationMs: 0, maxDurationMs: 500 }).semanticAmount).toBe(7);
    expect(createValueTransferPlan(Number.NaN, { minDurationMs: 0, maxDurationMs: 500 }).semanticAmount).toBe(0);
  });
});
