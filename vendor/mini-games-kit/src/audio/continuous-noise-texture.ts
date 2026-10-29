export interface ContinuousNoiseTextureProfile {
  minGain: number;
  maxGain: number;
  minBandHz: number;
  maxBandHz: number;
  minQ: number;
  maxQ: number;
  progressWeight: number;
  velocityWeight: number;
  updateMs: number;
  startAttackMs: number;
  startVelocityCap: number;
  startGainMultiplier: number;
  idleReleaseMs: number;
  releaseMs: number;
}

export interface ContinuousNoiseTextureMix {
  gain: number;
  bandHz: number;
  q: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const resolveContinuousNoiseTextureMix = (
  profile: ContinuousNoiseTextureProfile,
  progress: number,
  velocity: number,
  startupProgress = 1,
): ContinuousNoiseTextureMix => {
  const clampedProgress = clamp01(progress);
  const clampedVelocity = clamp01(velocity);
  const clampedStartup = clamp01(startupProgress);
  const weightTotal = Math.max(0.0001, profile.progressWeight + profile.velocityWeight);
  const progressWeight = profile.progressWeight / weightTotal;
  const velocityWeight = profile.velocityWeight / weightTotal;
  const startupVelocityCap =
    clamp01(profile.startVelocityCap) + (1 - clamp01(profile.startVelocityCap)) * clampedStartup;
  const effectiveVelocity = Math.min(clampedVelocity, startupVelocityCap);
  const intensity = Math.min(1, clampedProgress * progressWeight + effectiveVelocity * velocityWeight);
  const brightness = Math.min(1, clampedProgress * 0.72 + effectiveVelocity * 0.28);
  const startupGainMultiplier =
    clamp01(profile.startGainMultiplier) + (1 - clamp01(profile.startGainMultiplier)) * clampedStartup;

  return {
    gain: Math.max(0, profile.minGain + (profile.maxGain - profile.minGain) * intensity) * startupGainMultiplier,
    bandHz: Math.max(20, profile.minBandHz + (profile.maxBandHz - profile.minBandHz) * brightness),
    q: Math.max(0.1, profile.minQ + (profile.maxQ - profile.minQ) * effectiveVelocity),
  };
};

export const createLoopableNoiseBuffer = (
  context: BaseAudioContext,
  seconds = 4,
  initialSeed = 0x0a11d10f,
): AudioBuffer => {
  const safeSeconds = Math.max(0.1, seconds);
  const length = Math.max(1, Math.floor(context.sampleRate * safeSeconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let seed = initialSeed >>> 0;
  for (let index = 0; index < channel.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    channel[index] = (seed / 0xffffffff) * 2 - 1;
  }

  const fadeLength = Math.min(Math.floor(context.sampleRate * 0.12), Math.floor(channel.length / 8));
  for (let index = 0; index < fadeLength; index += 1) {
    const mix = index / Math.max(1, fadeLength - 1);
    const tailIndex = channel.length - fadeLength + index;
    channel[tailIndex] = (channel[tailIndex] ?? 0) * (1 - mix) + (channel[index] ?? 0) * mix;
  }
  return buffer;
};

/**
 * Reusable continuous tactile-noise graph for drag/scrub/tear-like interactions.
 * Input geometry stays outside this class; callers provide normalized progress and velocity.
 */
export class ContinuousNoiseTexture {
  private source: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private envelopeStartedAt: number | null = null;
  private disposed = false;

  public constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
    private readonly profile: ContinuousNoiseTextureProfile,
    private readonly noiseBuffer: AudioBuffer = createLoopableNoiseBuffer(context),
  ) {}

  public prime(): void {
    if (this.disposed) return;
    this.ensureGraph();
  }

  public update(progress: number, velocity: number): void {
    if (this.disposed || this.context.state !== 'running') return;
    this.ensureGraph();
    const now = this.context.currentTime;
    if (this.envelopeStartedAt === null) this.envelopeStartedAt = now;
    const startupProgress = Math.min(
      1,
      Math.max(0, ((now - this.envelopeStartedAt) * 1000) / Math.max(1, this.profile.startAttackMs)),
    );
    const mix = resolveContinuousNoiseTextureMix(this.profile, progress, velocity, startupProgress);
    const updateSeconds = Math.max(0.001, this.profile.updateMs / 1000);

    if (!this.filter || !this.gain) return;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(Math.max(0.0001, this.gain.gain.value), now);
    this.gain.gain.linearRampToValueAtTime(Math.max(0.0001, mix.gain), now + updateSeconds);
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(Math.max(20, this.filter.frequency.value), now);
    this.filter.frequency.linearRampToValueAtTime(mix.bandHz, now + updateSeconds);
    this.filter.Q.cancelScheduledValues(now);
    this.filter.Q.setValueAtTime(Math.max(0.1, this.filter.Q.value), now);
    this.filter.Q.linearRampToValueAtTime(mix.q, now + updateSeconds);
    this.queueIdleDecay();
  }

  public stop(immediate = false): void {
    this.cancelIdleDecay();
    const source = this.source;
    const filter = this.filter;
    const gain = this.gain;
    this.source = null;
    this.filter = null;
    this.gain = null;
    this.envelopeStartedAt = null;
    if (!source) return;

    if (immediate || this.context.state !== 'running' || !gain) {
      this.teardownGraph(source, filter, gain);
      return;
    }

    const now = this.context.currentTime;
    const releaseSeconds = Math.max(0.001, this.profile.releaseMs / 1000);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSeconds);
    try {
      source.stop(now + releaseSeconds + 0.025);
    } catch {
      // Already stopped during rapid teardown.
    }
    globalThis.setTimeout(() => this.disconnectGraph(source, filter, gain), this.profile.releaseMs + 70);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop(true);
  }

  private ensureGraph(): void {
    if (this.source && this.filter && this.gain) return;
    if (this.source || this.filter || this.gain) this.stop(true);

    const now = this.context.currentTime;
    const idleMix = resolveContinuousNoiseTextureMix(this.profile, 0, 0, 0);
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(idleMix.bandHz, now);
    filter.Q.setValueAtTime(idleMix.q, now);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    source.start(now, (now * 0.37) % Math.max(0.01, this.noiseBuffer.duration));
    this.source = source;
    this.filter = filter;
    this.gain = gain;
  }

  private queueIdleDecay(): void {
    this.cancelIdleDecay();
    this.idleTimer = globalThis.setTimeout(() => {
      this.idleTimer = null;
      this.silence();
    }, Math.max(0, this.profile.idleReleaseMs));
  }

  private cancelIdleDecay(): void {
    if (this.idleTimer === null) return;
    globalThis.clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private silence(): void {
    if (this.context.state !== 'running' || !this.gain) return;
    const now = this.context.currentTime;
    this.envelopeStartedAt = null;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(Math.max(0.0001, this.gain.gain.value), now);
    this.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.001, this.profile.releaseMs / 1000));
  }

  private teardownGraph(
    source: AudioBufferSourceNode,
    filter: BiquadFilterNode | null,
    gain: GainNode | null,
  ): void {
    try { source.stop(); } catch { /* already stopped */ }
    this.disconnectGraph(source, filter, gain);
  }

  private disconnectGraph(
    source: AudioBufferSourceNode,
    filter: BiquadFilterNode | null,
    gain: GainNode | null,
  ): void {
    try { source.disconnect(); } catch { /* already disconnected */ }
    try { filter?.disconnect(); } catch { /* already disconnected */ }
    try { gain?.disconnect(); } catch { /* already disconnected */ }
  }
}
