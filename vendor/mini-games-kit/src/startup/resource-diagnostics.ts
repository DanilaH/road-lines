export interface StartupResourceTimingLike {
  name: string;
  startTime: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
  nextHopProtocol: string;
}

export interface StartupSlowResource {
  key: string;
  durationMs: number;
  waitMs: number;
  downloadMs: number;
  transferKiB: number;
  encodedKiB: number;
}

export interface StartupResourceDiagnosticsSnapshot {
  metadata: Readonly<Record<string, string | number | boolean>>;
  loaderMaxParallelDownloads: number | undefined;
  queuedCount: number;
  observedCount: number;
  loaderWallMs: number | undefined;
  resourceSpanMs: number | undefined;
  settleAfterLastResponseMs: number | undefined;
  maxObservedNetworkConcurrency: number | undefined;
  transferKiB: number;
  encodedKiB: number;
  cacheLikeCount: number;
  protocols: string[];
  slowest: StartupSlowResource[];
}

export interface StartupResourceDiagnosticsOptions {
  maxParallelDownloads?: number;
  metadata?: Readonly<Record<string, string | number | boolean>>;
  baseUrl?: string;
  slowestLimit?: number;
  now?: () => number;
  getResourceEntries?: () => readonly StartupResourceTimingLike[];
}

interface QueuedResource {
  key: string;
  requestUrl: string | undefined;
}

const defaultNow = (): number =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

const defaultResourceEntries = (): readonly StartupResourceTimingLike[] => {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return [];
  return performance.getEntriesByType('resource') as PerformanceResourceTiming[];
};

const defaultBaseUrl = (): string | undefined =>
  typeof document === 'undefined' ? undefined : document.baseURI;

const rounded = (value: number): number => Math.max(0, Math.round(value));
const roundedKiB = (bytes: number): number => Math.max(0, Math.round(bytes / 102.4) / 10);

export const toAbsoluteResourceUrl = (
  requestPath: string,
  baseUrl: string | undefined = defaultBaseUrl(),
): string | undefined => {
  if (!baseUrl) return requestPath;
  try {
    return new URL(requestPath, baseUrl).href;
  } catch {
    return undefined;
  }
};

export const appendQueryToken = (
  assetPath: string,
  param: string,
  token: string | undefined,
): string => {
  if (!token) return assetPath;
  const separator = assetPath.includes('?') ? '&' : '?';
  return `${assetPath}${separator}${encodeURIComponent(param)}=${encodeURIComponent(token)}`;
};

export const buildStartupExperimentUrl = (
  href: string,
  params: Readonly<Record<string, string | number | undefined>>,
): string => {
  const url = new URL(href);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
};

export const resolveObservedNetworkConcurrency = (
  entries: readonly StartupResourceTimingLike[],
): number | undefined => {
  if (entries.length === 0) return undefined;
  const events: Array<{ at: number; delta: 1 | -1 }> = [];
  for (const entry of entries) {
    const start = entry.requestStart > 0 ? entry.requestStart : entry.startTime;
    if (!(entry.responseEnd > start)) continue;
    events.push({ at: start, delta: 1 }, { at: entry.responseEnd, delta: -1 });
  }
  if (events.length === 0) return undefined;
  events.sort((left, right) => left.at - right.at || left.delta - right.delta);
  let active = 0;
  let maxActive = 0;
  for (const event of events) {
    active += event.delta;
    maxActive = Math.max(maxActive, active);
  }
  return maxActive;
};

/**
 * Correlates explicitly queued startup resources with Resource Timing entries.
 * Create one instance at the beginning of the loader wall being measured.
 */
export class StartupResourceDiagnostics {
  private readonly startedAt: number;
  private readonly queued: QueuedResource[] = [];
  private readonly now: () => number;
  private readonly getResourceEntries: () => readonly StartupResourceTimingLike[];
  private readonly slowestLimit: number;
  private settledAt: number | undefined;
  private finalizedSnapshot: StartupResourceDiagnosticsSnapshot | undefined;

  public constructor(private readonly options: StartupResourceDiagnosticsOptions = {}) {
    this.now = options.now ?? defaultNow;
    this.getResourceEntries = options.getResourceEntries ?? defaultResourceEntries;
    this.slowestLimit = Math.max(1, Math.floor(options.slowestLimit ?? 8));
    this.startedAt = this.now();
  }

  public record(key: string, requestPath: string): string {
    this.queued.push({ key, requestUrl: toAbsoluteResourceUrl(requestPath, this.options.baseUrl) });
    return requestPath;
  }

  public finalize(): StartupResourceDiagnosticsSnapshot {
    this.settledAt ??= this.now();
    this.finalizedSnapshot ??= this.makeSnapshot();
    return this.finalizedSnapshot;
  }

  public getSnapshot(): StartupResourceDiagnosticsSnapshot {
    return this.finalizedSnapshot ?? this.makeSnapshot();
  }

  private makeSnapshot(): StartupResourceDiagnosticsSnapshot {
    const resourceTimings = this.getResourceEntries();
    const timingByUrl = new Map(resourceTimings.map((entry) => [entry.name, entry]));
    const observed = this.queued.flatMap((resource) => {
      if (!resource.requestUrl) return [];
      const timing = timingByUrl.get(resource.requestUrl);
      return timing ? [{ resource, timing }] : [];
    });
    const observedTimings = observed.map(({ timing }) => timing);
    const earliestStart = observedTimings.length > 0
      ? Math.min(...observedTimings.map((entry) => entry.startTime))
      : undefined;
    const latestResponseEnd = observedTimings.length > 0
      ? Math.max(...observedTimings.map((entry) => entry.responseEnd))
      : undefined;

    const slowest = observed
      .map(({ resource, timing }): StartupSlowResource => {
        const requestStart = timing.requestStart > 0 ? timing.requestStart : timing.startTime;
        const responseStart = timing.responseStart > 0 ? timing.responseStart : requestStart;
        return {
          key: resource.key,
          durationMs: rounded(timing.duration),
          waitMs: rounded(Math.max(0, responseStart - requestStart)),
          downloadMs: rounded(Math.max(0, timing.responseEnd - responseStart)),
          transferKiB: roundedKiB(timing.transferSize),
          encodedKiB: roundedKiB(timing.encodedBodySize),
        };
      })
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, this.slowestLimit);

    return {
      metadata: this.options.metadata ?? {},
      loaderMaxParallelDownloads: this.options.maxParallelDownloads,
      queuedCount: this.queued.length,
      observedCount: observed.length,
      loaderWallMs: this.settledAt === undefined ? undefined : rounded(this.settledAt - this.startedAt),
      resourceSpanMs: earliestStart === undefined || latestResponseEnd === undefined
        ? undefined
        : rounded(latestResponseEnd - earliestStart),
      settleAfterLastResponseMs: this.settledAt === undefined || latestResponseEnd === undefined
        ? undefined
        : rounded(this.settledAt - latestResponseEnd),
      maxObservedNetworkConcurrency: resolveObservedNetworkConcurrency(observedTimings),
      transferKiB: roundedKiB(observedTimings.reduce((total, entry) => total + entry.transferSize, 0)),
      encodedKiB: roundedKiB(observedTimings.reduce((total, entry) => total + entry.encodedBodySize, 0)),
      cacheLikeCount: observedTimings.filter(
        (entry) => entry.transferSize === 0 && entry.encodedBodySize > 0,
      ).length,
      protocols: [...new Set(observedTimings.map((entry) => entry.nextHopProtocol).filter(Boolean))].sort(),
      slowest,
    };
  }
}
