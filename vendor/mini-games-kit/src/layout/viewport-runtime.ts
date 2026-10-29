export interface ViewportSize {
  width: number;
  height: number;
}

export interface ViewportState extends ViewportSize {
  portrait: boolean;
}

const isUsableViewport = (size: ViewportSize | null | undefined): size is ViewportSize =>
  Boolean(size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0);

export const isPortraitViewport = (size: ViewportSize): boolean => size.height > size.width;

export const shouldSyncLandscapeBackingStore = (
  viewport: Pick<ViewportState, 'portrait'>,
): boolean => !viewport.portrait;

export const resolveLandscapeGameCssSize = (
  viewport: ViewportSize,
  maxAspectRatio = 2,
): ViewportSize => {
  const height = Math.max(1, viewport.height);
  return {
    width: Math.max(1, Math.min(viewport.width, height * Math.max(1, maxAspectRatio))),
    height,
  };
};

export const resolveInitialLandscapeGameCssSize = (
  viewport: ViewportState,
  maxAspectRatio = 2,
): ViewportSize => {
  if (!viewport.portrait) return resolveLandscapeGameCssSize(viewport, maxAspectRatio);
  return resolveLandscapeGameCssSize({ width: viewport.height, height: viewport.width }, maxAspectRatio);
};

const resolvePortrait = (
  visualViewport: ViewportSize | null | undefined,
  innerViewport: ViewportSize | null | undefined,
  documentViewport: ViewportSize | null | undefined,
  mediaPortrait: boolean | null,
): boolean => {
  const inner = isUsableViewport(innerViewport) ? innerViewport : null;
  const documentSize = isUsableViewport(documentViewport) ? documentViewport : null;
  const visual = isUsableViewport(visualViewport) ? visualViewport : null;

  if (inner && documentSize) {
    const innerPortrait = isPortraitViewport(inner);
    const documentPortrait = isPortraitViewport(documentSize);
    if (innerPortrait === documentPortrait) return innerPortrait;
    if (mediaPortrait !== null) return mediaPortrait;
    return innerPortrait;
  }
  if (inner) return isPortraitViewport(inner);
  if (documentSize) return isPortraitViewport(documentSize);
  if (visual) return isPortraitViewport(visual);
  return mediaPortrait ?? false;
};

/**
 * Produces one coherent snapshot so the orientation gate, CSS shell and engine
 * resize path cannot each act on a different mobile-browser geometry phase.
 */
export const resolveViewportState = (
  visualViewport: ViewportSize | null | undefined,
  innerViewport: ViewportSize | null | undefined,
  documentViewport: ViewportSize | null | undefined,
  mediaPortrait: boolean | null,
): ViewportState => {
  const portrait = resolvePortrait(visualViewport, innerViewport, documentViewport, mediaPortrait);
  const candidates = [visualViewport, innerViewport, documentViewport].filter(isUsableViewport);
  const size = candidates.find((candidate) => isPortraitViewport(candidate) === portrait)
    ?? candidates[0]
    ?? { width: 1, height: 1 };
  return { width: size.width, height: size.height, portrait };
};

export type ViewportApplyReason = 'initial' | 'event' | 'animation-frame' | 'settle' | 'watchdog';

export interface BrowserViewportApplyContext {
  reason: ViewportApplyReason;
  changed: boolean;
}

export interface BrowserViewportWatcherOptions {
  onApply: (viewport: ViewportState, context: BrowserViewportApplyContext) => void;
  window?: Window;
  document?: Document;
  settleDelaysMs?: readonly number[];
  watchdogMs?: number;
  orientationMediaQuery?: string;
}

const viewportSignature = (viewport: ViewportState): string =>
  `${Math.round(viewport.width)}x${Math.round(viewport.height)}:${viewport.portrait ? 'p' : 'l'}`;

/**
 * Browser event orchestration extracted from real Android Chrome/WebView rotation
 * failures. It intentionally emits settle passes even when dimensions are equal;
 * engine adapters can use `context.changed` to choose resize vs refresh behavior.
 */
export class BrowserViewportWatcher {
  private readonly win: Window;
  private readonly doc: Document;
  private readonly settleDelaysMs: readonly number[];
  private readonly watchdogMs: number;
  private readonly orientationMedia: MediaQueryList | null;
  private readonly screenOrientation: ScreenOrientation | null;
  private started = false;
  private lastSignature = '';
  private animationFrame: number | null = null;
  private settleTimers: number[] = [];
  private watchdog: number | null = null;

  public constructor(private readonly options: BrowserViewportWatcherOptions) {
    const resolvedWindow = options.window ?? (typeof window === 'undefined' ? undefined : window);
    if (!resolvedWindow) throw new Error('BrowserViewportWatcher requires a Window');
    this.win = resolvedWindow;
    this.doc = options.document ?? resolvedWindow.document;
    this.settleDelaysMs = options.settleDelaysMs ?? [120, 360, 700, 1200, 2000];
    this.watchdogMs = Math.max(100, options.watchdogMs ?? 500);
    this.orientationMedia = typeof this.win.matchMedia === 'function'
      ? this.win.matchMedia(options.orientationMediaQuery ?? '(orientation: portrait)')
      : null;
    this.screenOrientation = this.win.screen.orientation ?? null;
  }

  public read(): ViewportState {
    const visual = this.win.visualViewport;
    return resolveViewportState(
      visual ? { width: visual.width, height: visual.height } : null,
      { width: this.win.innerWidth, height: this.win.innerHeight },
      { width: this.doc.documentElement.clientWidth, height: this.doc.documentElement.clientHeight },
      this.orientationMedia?.matches ?? null,
    );
  }

  public start(): void {
    if (this.started) return;
    this.started = true;
    this.apply('initial');
    this.win.addEventListener('resize', this.handleEvent);
    this.win.addEventListener('orientationchange', this.handleEvent);
    this.win.addEventListener('pageshow', this.handleEvent);
    this.win.addEventListener('focus', this.handleEvent);
    this.win.visualViewport?.addEventListener('resize', this.handleEvent);
    this.screenOrientation?.addEventListener('change', this.handleEvent);
    this.orientationMedia?.addEventListener('change', this.handleEvent);
    this.watchdog = this.win.setInterval(() => {
      const next = this.read();
      if (viewportSignature(next) !== this.lastSignature) this.schedule('watchdog');
    }, this.watchdogMs);
  }

  public refresh(): void {
    this.schedule('event');
  }

  public destroy(): void {
    if (!this.started) return;
    this.started = false;
    this.win.removeEventListener('resize', this.handleEvent);
    this.win.removeEventListener('orientationchange', this.handleEvent);
    this.win.removeEventListener('pageshow', this.handleEvent);
    this.win.removeEventListener('focus', this.handleEvent);
    this.win.visualViewport?.removeEventListener('resize', this.handleEvent);
    this.screenOrientation?.removeEventListener('change', this.handleEvent);
    this.orientationMedia?.removeEventListener('change', this.handleEvent);
    if (this.animationFrame !== null) this.win.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    for (const timer of this.settleTimers) this.win.clearTimeout(timer);
    this.settleTimers = [];
    if (this.watchdog !== null) this.win.clearInterval(this.watchdog);
    this.watchdog = null;
  }

  private readonly handleEvent = (): void => this.schedule('event');

  private schedule(reason: 'event' | 'watchdog'): void {
    if (!this.started) return;
    this.apply(reason);
    if (this.animationFrame !== null) this.win.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = this.win.requestAnimationFrame(() => {
      this.animationFrame = null;
      this.apply('animation-frame');
    });
    for (const timer of this.settleTimers) this.win.clearTimeout(timer);
    this.settleTimers = this.settleDelaysMs.map((delayMs) => this.win.setTimeout(() => {
      this.apply('settle');
    }, delayMs));
  }

  private apply(reason: ViewportApplyReason): void {
    const viewport = this.read();
    const signature = viewportSignature(viewport);
    const changed = signature !== this.lastSignature;
    this.options.onApply(viewport, { reason, changed });
    this.lastSignature = signature;
  }
}
