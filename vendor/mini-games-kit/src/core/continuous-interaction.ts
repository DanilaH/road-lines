const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export interface ContinuousInteractionProfile {
  /** Progress units per second that should read as maximum presentation velocity. */
  velocityForMax?: number;
  /** Protects velocity from zero/near-zero timestamp deltas. */
  minElapsedSeconds?: number;
  /** Below this progress the interaction is treated as presentation-idle. */
  minActiveProgress?: number;
  /** Below this progress delta continuous feedback may remain quiet. */
  minActiveProgressDelta?: number;
}

export interface ContinuousInteractionSample {
  progress: number;
  progressDelta: number;
  elapsedSeconds: number;
  normalizedVelocity: number;
  active: boolean;
  completed: boolean;
}

export const normalizePositiveProgress = (distance: number, completionDistance: number): number => {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  if (!Number.isFinite(completionDistance) || completionDistance <= 0) {
    throw new Error(`completionDistance must be positive and finite; received ${completionDistance}`);
  }
  return clamp01(distance / completionDistance);
};

/**
 * Converts a project's own interaction geometry into stable semantic feel inputs.
 *
 * Raw pointer coordinates, hitboxes and completion rules deliberately stay outside this helper.
 * Consumers feed normalized progress and receive bounded velocity/activity semantics that can drive
 * sound, material response, motion or other presentation without coupling those systems to input APIs.
 */
export const sampleContinuousInteraction = (
  progress: number,
  previousProgress: number,
  timestampMs: number,
  previousTimestampMs: number,
  profile: ContinuousInteractionProfile = {},
): ContinuousInteractionSample => {
  const current = clamp01(progress);
  const previous = clamp01(previousProgress);
  const progressDelta = Math.abs(current - previous);
  const minElapsedSeconds = Math.max(0.0001, profile.minElapsedSeconds ?? 0.008);
  const elapsedSeconds = Math.max(
    minElapsedSeconds,
    Number.isFinite(timestampMs) && Number.isFinite(previousTimestampMs)
      ? Math.max(0, (timestampMs - previousTimestampMs) / 1000)
      : minElapsedSeconds,
  );
  const velocityForMax = Math.max(0.0001, profile.velocityForMax ?? 4);
  const normalizedVelocity = clamp01(progressDelta / elapsedSeconds / velocityForMax);
  const minActiveProgress = Math.max(0, profile.minActiveProgress ?? 0.005);
  const minActiveProgressDelta = Math.max(0, profile.minActiveProgressDelta ?? 0.0005);

  return {
    progress: current,
    progressDelta,
    elapsedSeconds,
    normalizedVelocity,
    active: current > minActiveProgress && progressDelta > minActiveProgressDelta,
    completed: current >= 1,
  };
};
