export type StartupPreloadPhase =
  | 'idle'
  | 'pending-show'
  | 'visible'
  | 'completing'
  | 'hidden'
  | 'failed';

export interface StartupPreloadCopy {
  heading: string;
  status: string;
  failedHeading: string;
  failedStatus: string;
}

export interface StartupPreloadSnapshot {
  phase: StartupPreloadPhase;
  progress: number;
  copy: StartupPreloadCopy;
  failureMessage: string | undefined;
}

export interface StartupPreloadView {
  render(snapshot: StartupPreloadSnapshot): void;
}

export interface StartupPreloadScheduler {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(handle: number): void;
  setInterval(callback: () => void, delayMs: number): number;
  clearInterval(handle: number): void;
}

export interface StartupPreloadOptions {
  showDelayMs?: number;
  minVisibleMs?: number;
  completionHoldMs?: number;
  progressTickMs?: number;
  fatalTimeoutMs?: number;
  preCompleteCap?: number;
  copy?: StartupPreloadCopy;
}

interface ResolvedStartupPreloadOptions {
  showDelayMs: number;
  minVisibleMs: number;
  completionHoldMs: number;
  progressTickMs: number;
  fatalTimeoutMs: number;
  preCompleteCap: number;
}

const DEFAULT_COPY: StartupPreloadCopy = {
  heading: 'LOADING',
  status: 'Preparing game…',
  failedHeading: 'LOAD FAILED',
  failedStatus: 'Startup stalled. Reload to retry.',
};

const DEFAULT_OPTIONS: ResolvedStartupPreloadOptions = {
  showDelayMs: 200,
  minVisibleMs: 520,
  completionHoldMs: 180,
  progressTickMs: 100,
  fatalTimeoutMs: 90_000,
  preCompleteCap: 0.92,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number): number => 1 - Math.pow(1 - clamp01(value), 3);
const easeOutQuad = (value: number): number => 1 - Math.pow(1 - clamp01(value), 2);

export const computeStartupFakeProgress = (
  elapsedMs: number,
  cap = DEFAULT_OPTIONS.preCompleteCap,
): number => {
  const safeElapsed = Math.max(0, elapsedMs);
  const safeCap = Math.max(0.88, Math.min(0.98, cap));
  if (safeElapsed <= 1_200) {
    return 0.08 + (0.65 - 0.08) * easeOutCubic(safeElapsed / 1_200);
  }
  if (safeElapsed <= 5_000) {
    return 0.65 + (0.88 - 0.65) * easeOutQuad((safeElapsed - 1_200) / 3_800);
  }
  const tail = 1 - Math.exp(-(safeElapsed - 5_000) / 7_000);
  return Math.min(safeCap, 0.88 + (safeCap - 0.88) * tail);
};

const resolveOptions = (options: StartupPreloadOptions): ResolvedStartupPreloadOptions => ({
  showDelayMs: options.showDelayMs ?? DEFAULT_OPTIONS.showDelayMs,
  minVisibleMs: options.minVisibleMs ?? DEFAULT_OPTIONS.minVisibleMs,
  completionHoldMs: options.completionHoldMs ?? DEFAULT_OPTIONS.completionHoldMs,
  progressTickMs: options.progressTickMs ?? DEFAULT_OPTIONS.progressTickMs,
  fatalTimeoutMs: options.fatalTimeoutMs ?? DEFAULT_OPTIONS.fatalTimeoutMs,
  preCompleteCap: options.preCompleteCap ?? DEFAULT_OPTIONS.preCompleteCap,
});

const createBrowserScheduler = (): StartupPreloadScheduler => ({
  now: () => performance.now(),
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle) => window.clearTimeout(handle),
  setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
  clearInterval: (handle) => window.clearInterval(handle),
});

export class StartupPreloadController {
  private phase: StartupPreloadPhase = 'idle';
  private progress = 0.08;
  private copy: StartupPreloadCopy;
  private failureMessage: string | undefined;
  private startedAt = 0;
  private visibleAt: number | null = null;
  private showTimer: number | null = null;
  private completionTimer: number | null = null;
  private fatalTimer: number | null = null;
  private progressTimer: number | null = null;
  private readonly options: ResolvedStartupPreloadOptions;

  public constructor(
    private readonly view: StartupPreloadView,
    options: StartupPreloadOptions = {},
    private readonly scheduler: StartupPreloadScheduler = createBrowserScheduler(),
  ) {
    this.options = resolveOptions(options);
    this.copy = options.copy ?? DEFAULT_COPY;
    this.emit();
  }

  public getPhase(): StartupPreloadPhase {
    return this.phase;
  }

  public getProgress(): number {
    return this.progress;
  }

  public begin(): void {
    if (this.phase !== 'idle') return;
    this.phase = 'pending-show';
    this.startedAt = this.scheduler.now();
    this.progress = computeStartupFakeProgress(0, this.options.preCompleteCap);
    this.failureMessage = undefined;
    this.emit();

    this.showTimer = this.scheduler.setTimeout(() => {
      this.showTimer = null;
      if (this.phase !== 'pending-show') return;
      this.phase = 'visible';
      this.visibleAt = this.scheduler.now();
      this.emit();
    }, this.options.showDelayMs);
    this.progressTimer = this.scheduler.setInterval(() => this.tickProgress(), this.options.progressTickMs);
    this.fatalTimer = this.scheduler.setTimeout(() => {
      this.fatalTimer = null;
      this.fail();
    }, this.options.fatalTimeoutMs);
  }

  public setCopy(copy: StartupPreloadCopy): void {
    this.copy = copy;
    this.emit();
  }

  public complete(): void {
    if (this.phase === 'idle' || this.phase === 'hidden' || this.phase === 'completing') return;
    this.clearShowTimer();
    this.clearFatalTimer();
    this.clearProgressTimer();
    this.failureMessage = undefined;
    this.progress = 1;

    if (this.phase === 'pending-show') {
      this.phase = 'hidden';
      this.emit();
      return;
    }

    this.phase = 'completing';
    const visibleForMs = this.visibleAt === null ? 0 : this.scheduler.now() - this.visibleAt;
    const remainingMinimumMs = Math.max(0, this.options.minVisibleMs - visibleForMs);
    const hideDelayMs = Math.max(this.options.completionHoldMs, remainingMinimumMs);
    this.emit();
    this.completionTimer = this.scheduler.setTimeout(() => {
      this.completionTimer = null;
      if (this.phase !== 'completing') return;
      this.phase = 'hidden';
      this.emit();
    }, hideDelayMs);
  }

  public fail(message?: string): void {
    if (this.phase === 'hidden' || this.phase === 'completing') return;
    this.clearShowTimer();
    this.clearFatalTimer();
    this.clearProgressTimer();
    this.clearCompletionTimer();
    this.phase = 'failed';
    this.visibleAt ??= this.scheduler.now();
    this.failureMessage = message;
    this.emit();
  }

  public destroy(): void {
    this.clearShowTimer();
    this.clearFatalTimer();
    this.clearProgressTimer();
    this.clearCompletionTimer();
    this.phase = 'hidden';
    this.emit();
  }

  private tickProgress(): void {
    if (this.phase !== 'pending-show' && this.phase !== 'visible') return;
    this.progress = computeStartupFakeProgress(
      this.scheduler.now() - this.startedAt,
      this.options.preCompleteCap,
    );
    this.emit();
  }

  private clearShowTimer(): void {
    if (this.showTimer === null) return;
    this.scheduler.clearTimeout(this.showTimer);
    this.showTimer = null;
  }

  private clearCompletionTimer(): void {
    if (this.completionTimer === null) return;
    this.scheduler.clearTimeout(this.completionTimer);
    this.completionTimer = null;
  }

  private clearFatalTimer(): void {
    if (this.fatalTimer === null) return;
    this.scheduler.clearTimeout(this.fatalTimer);
    this.fatalTimer = null;
  }

  private clearProgressTimer(): void {
    if (this.progressTimer === null) return;
    this.scheduler.clearInterval(this.progressTimer);
    this.progressTimer = null;
  }

  private emit(): void {
    this.view.render({
      phase: this.phase,
      progress: this.progress,
      copy: this.copy,
      failureMessage: this.failureMessage,
    });
  }
}

export interface StartupPreloadDomSelectors {
  overlay: string;
  heading: string;
  status: string;
  progressBar: string;
  progressFill: string;
  progressPercent: string;
}

const DEFAULT_SELECTORS: StartupPreloadDomSelectors = {
  overlay: '#startup-preload',
  heading: '#startup-preload-heading',
  status: '#startup-preload-status',
  progressBar: '#startup-preload-progress-bar',
  progressFill: '#startup-preload-progress-fill',
  progressPercent: '#startup-preload-progress-percent',
};

export const createStartupPreloadDomView = (
  root: Document = document,
  selectors: StartupPreloadDomSelectors = DEFAULT_SELECTORS,
): StartupPreloadView => {
  const overlay = root.querySelector<HTMLElement>(selectors.overlay);
  const heading = root.querySelector<HTMLElement>(selectors.heading);
  const status = root.querySelector<HTMLElement>(selectors.status);
  const progressBar = root.querySelector<HTMLElement>(selectors.progressBar);
  const progressFill = root.querySelector<HTMLElement>(selectors.progressFill);
  const progressPercent = root.querySelector<HTMLElement>(selectors.progressPercent);
  if (!overlay || !heading || !status || !progressBar || !progressFill || !progressPercent) {
    throw new Error('Startup preload DOM shell is incomplete');
  }

  return {
    render: (snapshot) => {
      const percent = Math.round(clamp01(snapshot.progress) * 100);
      overlay.dataset.state = snapshot.phase;
      overlay.setAttribute(
        'aria-hidden',
        snapshot.phase === 'idle' || snapshot.phase === 'hidden' ? 'true' : 'false',
      );
      overlay.setAttribute('aria-live', snapshot.phase === 'failed' ? 'assertive' : 'polite');
      heading.textContent = snapshot.phase === 'failed' ? snapshot.copy.failedHeading : snapshot.copy.heading;
      status.textContent = snapshot.phase === 'failed'
        ? snapshot.failureMessage ?? snapshot.copy.failedStatus
        : snapshot.copy.status;
      progressBar.setAttribute('aria-valuenow', String(percent));
      progressFill.style.width = `${percent}%`;
      progressPercent.textContent = `${String(percent).padStart(2, '0')}%`;
    },
  };
};
