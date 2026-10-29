import { describe, expect, it } from 'vitest';

import {
  normalizePositiveProgress,
  sampleContinuousInteraction,
} from '../src/core/continuous-interaction';

describe('continuous interaction semantics', () => {
  it('normalizes project-owned distance into bounded progress', () => {
    expect(normalizePositiveProgress(-10, 294)).toBe(0);
    expect(normalizePositiveProgress(147, 294)).toBe(0.5);
    expect(normalizePositiveProgress(400, 294)).toBe(1);
    expect(() => normalizePositiveProgress(10, 0)).toThrow(/completionDistance/);
  });

  it('reproduces the Signal 2000 progress velocity model by default', () => {
    const sample = sampleContinuousInteraction(0.5, 0.4, 1100, 1000);

    expect(sample.progress).toBe(0.5);
    expect(sample.progressDelta).toBeCloseTo(0.1);
    expect(sample.elapsedSeconds).toBeCloseTo(0.1);
    expect(sample.normalizedVelocity).toBeCloseTo(0.25);
    expect(sample.active).toBe(true);
    expect(sample.completed).toBe(false);
  });

  it('caps burst velocity and protects tiny time deltas', () => {
    const sample = sampleContinuousInteraction(0.2, 0, 1001, 1000);

    expect(sample.elapsedSeconds).toBe(0.008);
    expect(sample.normalizedVelocity).toBe(1);
  });

  it('keeps tiny/no-motion changes presentation-idle', () => {
    expect(sampleContinuousInteraction(0.004, 0, 1100, 1000).active).toBe(false);
    expect(sampleContinuousInteraction(0.5, 0.4998, 1100, 1000).active).toBe(false);
  });

  it('allows another project to tune velocity and activity thresholds without changing geometry', () => {
    const sample = sampleContinuousInteraction(0.25, 0.2, 1050, 1000, {
      velocityForMax: 2,
      minActiveProgress: 0.1,
      minActiveProgressDelta: 0.01,
    });

    expect(sample.normalizedVelocity).toBeCloseTo(0.5);
    expect(sample.active).toBe(true);
  });

  it('marks normalized completion independently from input implementation', () => {
    expect(sampleContinuousInteraction(1, 0.9, 1100, 1000).completed).toBe(true);
    expect(sampleContinuousInteraction(2, 0.9, 1100, 1000).progress).toBe(1);
  });
});
