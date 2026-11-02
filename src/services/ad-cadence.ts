import type { SyncStorage } from './save';
export const AD_CADENCE_KEY = 'road-lines.ads.v1';
interface CadenceState { version: 1; activeMs: number; lastAdMs: number | null; completedAtAd: number; unsettled: boolean; protectedLevel: string | null; }
/** Nonvaluable policy document, never copies a wallet/save. Storage failure disables forced ads. */
export class AdCadence {
  state: CadenceState;
  healthy = true;
  private since: number | null = null;
  private lastPersist = 0;
  constructor(private storage: SyncStorage, private now = () => performance.now()) {
    const fresh: CadenceState = { version: 1, activeMs: 0, lastAdMs: null, completedAtAd: 0, unsettled: false, protectedLevel: null };
    this.state = fresh;
    try {
      const raw = storage.getItem(AD_CADENCE_KEY);
      if (raw !== null) {
        const s = JSON.parse(raw) as CadenceState;
        if (s.version !== 1 || !Number.isSafeInteger(s.activeMs) || s.activeMs < 0 || !(s.lastAdMs === null || Number.isSafeInteger(s.lastAdMs) && s.lastAdMs >= 0 && s.lastAdMs <= s.activeMs) || !Number.isInteger(s.completedAtAd) || s.completedAtAd < 0 || s.completedAtAd > 90 || typeof s.unsettled !== 'boolean' || !(s.protectedLevel === null || typeof s.protectedLevel === 'string')) throw Error('Invalid cadence');
        this.state = s;
        // Process died before dismissal: require a fresh active interval on return.
        if (s.unsettled) { s.lastAdMs = s.activeMs; s.unsettled = false; this.persist(); }
      }
    } catch { this.healthy = false; }
    this.lastPersist = this.state.activeMs;
  }
  tick(): void {
    if (this.since === null) return;
    const now = this.now(); this.state.activeMs += Math.max(0, Math.round(now - this.since)); this.since = now;
    if (this.state.activeMs - this.lastPersist >= 5000) this.persist();
  }
  setActive(active: boolean): void { if (active === (this.since !== null)) return; this.tick(); this.since = active ? this.now() : null; if (!active) this.persist(); }
  private persist(): void {
    if (!this.healthy) return;
    try { this.storage.setItem(AD_CADENCE_KEY, JSON.stringify(this.state)); this.lastPersist = this.state.activeMs; }
    catch { this.healthy = false; }
  }
  eligible(completed: number, levelId: string, first: boolean): boolean {
    this.tick(); const s = this.state;
    return this.healthy && first && !s.unsettled && s.protectedLevel !== levelId && (s.lastAdMs === null ? completed >= 5 && s.activeMs >= 60_000 : completed - s.completedAtAd >= 3 && s.activeMs - s.lastAdMs >= 90_000);
  }
  protect(levelId: string): void { this.state.protectedLevel = levelId; this.persist(); }
  begin(completed: number): void { this.setActive(false); this.state.unsettled = true; this.state.completedAtAd = completed; this.persist(); }
  end(completed: number, shown: boolean): void {
    this.state.unsettled = false;
    if (shown) { this.state.lastAdMs = this.state.activeMs; this.state.completedAtAd = completed; }
    this.persist();
  }
}
