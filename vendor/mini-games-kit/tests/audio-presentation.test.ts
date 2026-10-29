import { describe, expect, it } from 'vitest';

import {
  applyBoundedPitchVariation,
  getAccumulationPitchMultiplier,
  resolveContinuousNoiseTextureMix,
  type ContinuousNoiseTextureProfile,
} from '../src/audio/index';

const signalDragProfile: ContinuousNoiseTextureProfile = {
  minGain: 0.0018,
  maxGain: 0.01,
  minBandHz: 950,
  maxBandHz: 2800,
  minQ: 0.55,
  maxQ: 1,
  progressWeight: 0.62,
  velocityWeight: 0.38,
  updateMs: 35,
  startAttackMs: 120,
  startVelocityCap: 0.32,
  startGainMultiplier: 0.28,
  idleReleaseMs: 90,
  releaseMs: 55,
};

describe('audio presentation primitives', () => {
  it('preserves the Signal 2000 continuous drag mix semantics when configured with its profile', () => {
    const idle = resolveContinuousNoiseTextureMix(signalDragProfile, 0, 0);
    const slowMid = resolveContinuousNoiseTextureMix(signalDragProfile, 0.5, 0.15);
    const fastMid = resolveContinuousNoiseTextureMix(signalDragProfile, 0.5, 0.9);
    const end = resolveContinuousNoiseTextureMix(signalDragProfile, 1, 1);
    const startupBurst = resolveContinuousNoiseTextureMix(signalDragProfile, 0.02, 1, 0);
    const steadyBurst = resolveContinuousNoiseTextureMix(signalDragProfile, 0.02, 1, 1);

    expect(idle.gain).toBe(signalDragProfile.minGain);
    expect(slowMid.gain).toBeGreaterThan(idle.gain);
    expect(fastMid.gain).toBeGreaterThan(slowMid.gain);
    expect(fastMid.bandHz).toBeGreaterThan(slowMid.bandHz);
    expect(end.gain).toBeLessThanOrEqual(signalDragProfile.maxGain);
    expect(end.bandHz).toBeLessThanOrEqual(signalDragProfile.maxBandHz);
    expect(startupBurst.gain).toBeLessThan(steadyBurst.gain * 0.5);
    expect(startupBurst.bandHz).toBeLessThan(steadyBurst.bandHz);
    expect(startupBurst.q).toBeLessThan(steadyBurst.q);
  });

  it('normalizes mix weights instead of relying on callers to sum exactly to one', () => {
    const profile = { ...signalDragProfile, progressWeight: 2, velocityWeight: 1 };
    const mix = resolveContinuousNoiseTextureMix(profile, 1, 1);
    expect(mix.gain).toBeLessThanOrEqual(profile.maxGain);
    expect(mix.bandHz).toBeLessThanOrEqual(profile.maxBandHz);
  });

  it('keeps narrow one-shot variation bounded', () => {
    expect(applyBoundedPitchVariation(0.03, 0)).toBeCloseTo(0.97);
    expect(applyBoundedPitchVariation(0.03, 0.5)).toBe(1);
    expect(applyBoundedPitchVariation(0.03, 1)).toBeCloseTo(1.03);
  });

  it('supports one rising contour across a whole value-transfer sequence', () => {
    const profile = { startMultiplier: 0.92, endMultiplier: 1.18, jitterAmount: 0.012 };
    const start = getAccumulationPitchMultiplier(0, profile, 0.5);
    const middle = getAccumulationPitchMultiplier(0.5, profile, 0.5);
    const end = getAccumulationPitchMultiplier(1, profile, 0.5);

    expect(start).toBeCloseTo(0.92);
    expect(start).toBeLessThan(middle);
    expect(middle).toBeLessThan(end);
    expect(end).toBeCloseTo(1.18);
    expect(getAccumulationPitchMultiplier(1, profile, 1)).toBeLessThanOrEqual(1.2);
  });
});
