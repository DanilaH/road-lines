export interface AudioDuckProfile {
  multiplier: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
}

export interface ManagedAudioLayer {
  /** Schedule owned sources to stop at an AudioContext time. */
  stop(atTimeSeconds: number): void;
  /** Disconnect owned nodes after their bus has faded. Must be idempotent. */
  disconnect(): void;
  /** Optional semantic progress modulation, e.g. banking intensity. */
  setProgress?(progress: number): void;
}

export interface BaseAudioLayerSpec {
  gain: number;
  fadeInMs: number;
  create(context: AudioContext, output: AudioNode): ManagedAudioLayer;
}

export interface PersistentAudioLayerSpec<State> {
  gain: number;
  baseMixMultiplier: number;
  fadeInMs: number;
  fadeOutMs: number;
  create(context: AudioContext, output: AudioNode, state: State): ManagedAudioLayer;
}

export type AudioDestinationResolver = (context: AudioContext) => AudioNode;
export type AudioStateComparator<State> = (left: State, right: State) => boolean;

export interface PresentationAudioMixerOptions<State> {
  base: BaseAudioLayerSpec;
  resolvePersistent(state: State): PersistentAudioLayerSpec<State>;
  /** Existing context. If omitted, the mixer lazily creates and owns one. */
  context?: AudioContext;
  contextFactory?: () => AudioContext;
  /** Optional master bus/destination. Defaults to `context.destination`. */
  destination?: AudioNode | AudioDestinationResolver;
  /**
   * Equality used to decide whether a requested persistent state already owns the mix.
   * Primitive state keys work well with the default `Object.is` comparator. Object-shaped
   * states should normally provide a semantic comparator to avoid needless layer recreation.
   */
  areStatesEqual?: AudioStateComparator<State>;
}

interface ActivePersistent<State> {
  state: State;
  spec: PersistentAudioLayerSpec<State>;
  bus: GainNode;
  layer: ManagedAudioLayer;
}

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

const safeGain = (value: number): number => Math.max(0.0001, Number.isFinite(value) ? value : 0.0001);

/**
 * Owns WebAudio presentation-layer lifecycle while leaving timbre/content in game-provided factories.
 *
 * Invariants:
 * - at most one persistent foreground state owns attention at a time;
 * - baseline ambience remains alive and is mixed down/up rather than recreated per result;
 * - mute/block suspend the existing context rather than creating replacement stacks;
 * - state replacement and clearing deterministically retire old layer ownership;
 * - delayed cleanup is flushed synchronously on dispose;
 * - this class never owns gameplay/durable state.
 */
export class PresentationAudioMixer<State> {
  private context: AudioContext | null;
  private readonly ownsContext: boolean;
  private baseBus: GainNode | null = null;
  private baseLayer: ManagedAudioLayer | null = null;
  private steadyBaseMultiplier = 1;
  private activePersistent: ActivePersistent<State> | null = null;
  private desiredPersistent: State | null = null;
  private muted = false;
  private blocked = false;
  private disposed = false;
  private readonly pendingCleanups = new Map<TimerHandle, () => void>();

  public constructor(private readonly options: PresentationAudioMixerOptions<State>) {
    this.context = options.context ?? null;
    this.ownsContext = options.context === undefined;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isBlocked(): boolean {
    return this.blocked;
  }

  public getActivePersistentState(): State | null {
    return this.activePersistent?.state ?? null;
  }

  public setMuted(muted: boolean): void {
    if (this.disposed || this.muted === muted) return;
    this.muted = muted;
    this.syncSuspension();
  }

  public setBlocked(blocked: boolean): void {
    if (this.disposed || this.blocked === blocked) return;
    this.blocked = blocked;
    this.syncSuspension();
  }

  public prime(): void {
    if (this.disposed || this.muted || this.blocked) return;
    const context = this.getContext();
    if (!context) return;
    const start = (): void => {
      if (this.disposed || this.muted || this.blocked || context.state !== 'running') return;
      this.ensureBase(context);
      this.syncDesiredPersistent(context);
    };
    if (context.state === 'running') start();
    else if (context.state === 'suspended') void context.resume().then(start).catch(() => undefined);
  }

  public duckBase(profile: AudioDuckProfile): void {
    if (this.disposed || this.muted || this.blocked) return;
    const context = this.getContext();
    if (!context) return;
    const apply = (): void => {
      if (this.disposed || this.muted || this.blocked || context.state !== 'running') return;
      this.ensureBase(context);
      const bus = this.baseBus;
      if (!bus) return;
      const now = context.currentTime;
      const steady = safeGain(this.options.base.gain * this.steadyBaseMultiplier);
      const ducked = safeGain(steady * Math.max(0, profile.multiplier));
      const attackAt = now + Math.max(0, profile.attackMs) / 1000;
      const holdAt = attackAt + Math.max(0, profile.holdMs) / 1000;
      const releaseAt = holdAt + Math.max(0, profile.releaseMs) / 1000;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(safeGain(bus.gain.value), now);
      bus.gain.linearRampToValueAtTime(ducked, attackAt);
      bus.gain.setValueAtTime(ducked, holdAt);
      bus.gain.linearRampToValueAtTime(steady, releaseAt);
    };
    if (context.state === 'running') apply();
    else if (context.state === 'suspended') void context.resume().then(apply).catch(() => undefined);
  }

  public setPersistentState(state: State): void {
    if (this.disposed) return;
    this.desiredPersistent = state;
    if (this.muted || this.blocked) return;
    const context = this.getContext();
    if (!context) return;
    const apply = (): void => {
      if (this.disposed || this.muted || this.blocked || context.state !== 'running') return;
      this.ensureBase(context);
      this.syncDesiredPersistent(context);
    };
    if (context.state === 'running') apply();
    else if (context.state === 'suspended') void context.resume().then(apply).catch(() => undefined);
  }

  public clearPersistentState(): void {
    if (this.disposed) return;
    this.desiredPersistent = null;
    const context = this.context;
    if (!context) return;
    this.stopPersistent(context, true);
  }

  public setPersistentProgress(progress: number): void {
    const active = this.activePersistent;
    if (!active?.layer.setProgress) return;
    active.layer.setProgress(Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)));
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.desiredPersistent = null;
    const context = this.context;
    if (context) {
      this.stopPersistent(context, false, true);
      this.flushPendingCleanups();
      if (this.baseLayer) {
        try { this.baseLayer.stop(context.currentTime); } catch { /* already stopped */ }
        try { this.baseLayer.disconnect(); } catch { /* already disconnected */ }
      }
      try { this.baseBus?.disconnect(); } catch { /* already disconnected */ }
      this.baseLayer = null;
      this.baseBus = null;
      if (this.ownsContext && context.state !== 'closed') void context.close().catch(() => undefined);
    } else {
      this.flushPendingCleanups();
    }
    this.context = null;
  }

  private getContext(): AudioContext | null {
    if (this.context) return this.context;
    if (this.disposed) return null;
    try {
      const factory = this.options.contextFactory ?? (() => new AudioContext());
      this.context = factory();
      return this.context;
    } catch {
      return null;
    }
  }

  private getDestination(context: AudioContext): AudioNode {
    const configured = this.options.destination;
    if (typeof configured === 'function') return configured(context);
    return configured ?? context.destination;
  }

  private ensureBase(context: AudioContext): void {
    if (this.baseBus && this.baseLayer) return;
    const now = context.currentTime;
    const bus = context.createGain();
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.linearRampToValueAtTime(
      safeGain(this.options.base.gain * this.steadyBaseMultiplier),
      now + Math.max(0, this.options.base.fadeInMs) / 1000,
    );
    bus.connect(this.getDestination(context));
    this.baseBus = bus;
    this.baseLayer = this.options.base.create(context, bus);
  }

  private syncDesiredPersistent(context: AudioContext): void {
    const desired = this.desiredPersistent;
    if (desired === null) {
      this.stopPersistent(context, true);
      return;
    }
    const comparator = this.options.areStatesEqual ?? Object.is;
    if (this.activePersistent && comparator(this.activePersistent.state, desired)) return;

    this.stopPersistent(context, false);
    const spec = this.options.resolvePersistent(desired);
    this.setSteadyBaseMultiplier(context, spec.baseMixMultiplier, spec.fadeInMs);
    const now = context.currentTime;
    const bus = context.createGain();
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.linearRampToValueAtTime(safeGain(spec.gain), now + Math.max(0, spec.fadeInMs) / 1000);
    bus.connect(this.getDestination(context));
    const layer = spec.create(context, bus, desired);
    this.activePersistent = { state: desired, spec, bus, layer };
  }

  private stopPersistent(
    context: AudioContext,
    restoreBase: boolean,
    immediate = false,
  ): void {
    const active = this.activePersistent;
    this.activePersistent = null;
    if (!active) {
      if (restoreBase) this.setSteadyBaseMultiplier(context, 1, 180);
      return;
    }

    const fadeMs = immediate ? 0 : Math.max(0, active.spec.fadeOutMs);
    const now = context.currentTime;
    active.bus.gain.cancelScheduledValues(now);
    active.bus.gain.setValueAtTime(safeGain(active.bus.gain.value), now);
    active.bus.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.001, fadeMs / 1000));
    try { active.layer.stop(now + fadeMs / 1000 + 0.03); } catch { /* already stopped */ }

    const cleanup = (): void => {
      try { active.layer.disconnect(); } catch { /* already disconnected */ }
      try { active.bus.disconnect(); } catch { /* already disconnected */ }
    };
    if (immediate) cleanup();
    else this.scheduleCleanup(cleanup, fadeMs + 80);

    if (restoreBase) this.setSteadyBaseMultiplier(context, 1, Math.max(180, fadeMs));
  }

  private setSteadyBaseMultiplier(context: AudioContext, multiplier: number, rampMs: number): void {
    this.steadyBaseMultiplier = Math.max(0, Number.isFinite(multiplier) ? multiplier : 1);
    this.ensureBase(context);
    const bus = this.baseBus;
    if (!bus) return;
    const now = context.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(safeGain(bus.gain.value), now);
    bus.gain.linearRampToValueAtTime(
      safeGain(this.options.base.gain * this.steadyBaseMultiplier),
      now + Math.max(0, rampMs) / 1000,
    );
  }

  private scheduleCleanup(cleanup: () => void, delayMs: number): void {
    let timer: TimerHandle;
    timer = globalThis.setTimeout(() => {
      this.pendingCleanups.delete(timer);
      cleanup();
    }, Math.max(0, delayMs));
    this.pendingCleanups.set(timer, cleanup);
  }

  private flushPendingCleanups(): void {
    for (const [timer, cleanup] of this.pendingCleanups) {
      globalThis.clearTimeout(timer);
      cleanup();
    }
    this.pendingCleanups.clear();
  }

  private syncSuspension(): void {
    const context = this.context;
    if (!context) return;
    if (this.muted || this.blocked) {
      if (context.state === 'running') void context.suspend().catch(() => undefined);
      return;
    }
    if (context.state === 'suspended') {
      void context
        .resume()
        .then(() => {
          if (this.disposed || this.muted || this.blocked) return;
          this.ensureBase(context);
          this.syncDesiredPersistent(context);
        })
        .catch(() => undefined);
    }
  }
}

/** Small helper for factories that own a fixed group of source and processing nodes. */
export const createManagedAudioLayer = (
  sources: readonly AudioScheduledSourceNode[],
  nodes: readonly AudioNode[],
  setProgress?: (progress: number) => void,
): ManagedAudioLayer => {
  let disconnected = false;
  return {
    stop(atTimeSeconds: number): void {
      for (const source of sources) {
        try { source.stop(atTimeSeconds); } catch { /* already stopped */ }
      }
    },
    disconnect(): void {
      if (disconnected) return;
      disconnected = true;
      for (const source of sources) {
        try { source.disconnect(); } catch { /* already disconnected */ }
      }
      for (const node of nodes) {
        try { node.disconnect(); } catch { /* already disconnected */ }
      }
    },
    ...(setProgress ? { setProgress } : {}),
  };
};
