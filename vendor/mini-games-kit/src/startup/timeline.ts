export type StartupTimelinePoint<Phase extends string> = 'start' | Phase;

export interface StartupTimelineOptions {
  now?: () => number;
  round?: (value: number) => number;
}

const defaultNow = (): number =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

const defaultRound = (value: number): number => Math.max(0, Math.round(value));

/**
 * Small idempotent startup phase clock. It deliberately knows nothing about a
 * particular engine or platform; the consumer names phases and derived metrics.
 */
export class StartupTimeline<Phase extends string> {
  private readonly marks = new Map<StartupTimelinePoint<Phase>, number>([['start', 0]]);
  private readonly startedAt: number;
  private readonly now: () => number;
  private readonly round: (value: number) => number;

  public constructor(options: StartupTimelineOptions = {}) {
    this.now = options.now ?? defaultNow;
    this.round = options.round ?? defaultRound;
    this.startedAt = this.now();
  }

  public mark(phase: Phase): number {
    const existing = this.marks.get(phase);
    if (existing !== undefined) return existing;
    const at = this.round(this.now() - this.startedAt);
    this.marks.set(phase, at);
    return at;
  }

  public has(phase: Phase): boolean {
    return this.marks.has(phase);
  }

  public elapsed(start: StartupTimelinePoint<Phase>, end: Phase): number | undefined {
    const startValue = this.marks.get(start);
    const endValue = this.marks.get(end);
    if (startValue === undefined || endValue === undefined) return undefined;
    return this.round(endValue - startValue);
  }

  public getMarks(): ReadonlyMap<StartupTimelinePoint<Phase>, number> {
    return new Map(this.marks);
  }

  public snapshot<Metric extends string>(
    intervals: Record<Metric, readonly [StartupTimelinePoint<Phase>, Phase]>,
  ): Record<Metric, number | undefined> {
    const result = {} as Record<Metric, number | undefined>;
    for (const [metric, interval] of Object.entries(intervals) as Array<
      [Metric, readonly [StartupTimelinePoint<Phase>, Phase]]
    >) {
      result[metric] = this.elapsed(interval[0], interval[1]);
    }
    return result;
  }
}
