const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const applyBoundedPitchVariation = (
  variationAmount: number,
  randomUnit: number,
): number => {
  const amount = Math.max(0, variationAmount);
  return 1 + (clamp01(randomUnit) * 2 - 1) * amount;
};

export interface AccumulationPitchProfile {
  startMultiplier: number;
  endMultiplier: number;
  jitterAmount?: number;
}

/**
 * Bounded contour for repeated transfer ticks/clacks across one semantic sequence.
 * Reset progress only when the next transaction/sequence begins.
 */
export const getAccumulationPitchMultiplier = (
  progress: number,
  profile: AccumulationPitchProfile,
  jitterUnit = 0.5,
): number => {
  const clamped = clamp01(progress);
  const eased = 1 - (1 - clamped) * (1 - clamped);
  const contour = profile.startMultiplier + (profile.endMultiplier - profile.startMultiplier) * eased;
  const jitter = (clamp01(jitterUnit) * 2 - 1) * Math.max(0, profile.jitterAmount ?? 0);
  return contour * (1 + jitter);
};
