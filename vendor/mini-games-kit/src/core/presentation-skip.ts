export type PresentationSkipAction = () => void;

/**
 * Owns the single currently skippable presentation beat.
 * Durable/gameplay state never belongs here: callers register presentation completion only.
 * A request completes only that beat; registering the next beat happens separately.
 */
export class PresentationSkipController {
  private active: PresentationSkipAction | null = null;
  private guardUntil = 0;

  public reset(): void {
    this.active = null;
    this.guardUntil = 0;
  }

  public guardUntilTime(timestamp: number): void {
    this.guardUntil = Math.max(this.guardUntil, timestamp);
  }

  public register(action: PresentationSkipAction): () => void {
    this.active = action;
    return () => {
      if (this.active === action) this.active = null;
    };
  }

  public request(now: number): boolean {
    if (now < this.guardUntil || !this.active) return false;
    const action = this.active;
    this.active = null;
    action();
    return true;
  }

  public hasActiveBeat(): boolean {
    return this.active !== null;
  }
}
