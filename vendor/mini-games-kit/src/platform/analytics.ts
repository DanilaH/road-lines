export type AnalyticsParams = Readonly<Record<string, boolean | number | string>>;

export interface AnalyticsAdapter {
  track(event: string, params?: AnalyticsParams): void;
}

export class ConsoleAnalyticsAdapter implements AnalyticsAdapter {
  public constructor(private readonly enabled = true) {}

  public track(event: string, params?: AnalyticsParams): void {
    if (!this.enabled) return;
    console.info('[analytics]', event, params ?? {});
  }
}
