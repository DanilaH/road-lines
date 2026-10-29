export interface ActionInterstitialGateConfig {
  initialGraceMs: number;
  minIntervalMs: number;
  minActionsBetweenRequests: number;
}

export const DEFAULT_ACTION_INTERSTITIAL_GATE: Readonly<ActionInterstitialGateConfig> = {
  initialGraceMs: 180_000,
  minIntervalMs: 180_000,
  minActionsBetweenRequests: 4,
};

/**
 * Pure local eligibility gate for interstitial requests.
 *
 * It counts requests, not successful impressions: once eligibility is consumed the full
 * cooldown starts even if the platform throttles, errors or returns no fill.
 */
export class ActionInterstitialGate {
  private nextEligibleAtMs: number | null = null;
  private actionsSinceRequest = 0;

  public constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly config: Readonly<ActionInterstitialGateConfig> = DEFAULT_ACTION_INTERSTITIAL_GATE,
  ) {}

  public markReady(): void {
    if (this.nextEligibleAtMs !== null) return;
    this.nextEligibleAtMs = this.now() + Math.max(0, this.config.initialGraceMs);
  }

  public recordEligibleAction(): boolean {
    this.actionsSinceRequest += 1;
    const now = this.now();
    if (this.nextEligibleAtMs === null) {
      this.nextEligibleAtMs = now + Math.max(0, this.config.initialGraceMs);
    }

    if (this.actionsSinceRequest < Math.max(1, this.config.minActionsBetweenRequests)) return false;
    if (now < this.nextEligibleAtMs) return false;

    this.actionsSinceRequest = 0;
    this.nextEligibleAtMs = now + Math.max(0, this.config.minIntervalMs);
    return true;
  }
}
