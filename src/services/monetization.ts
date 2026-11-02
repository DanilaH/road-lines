import { DurableReceiptQueue } from '../../vendor/mini-games-kit/src/platform/durable-receipt-queue';
import { createAdsBridge, type AdsBridge, type AdEvent, type AdKind } from '../platform/ads';
import { NativeBanner } from '../platform/banner';
import { validAdReceipt, type AdReceipt } from '../core/monetization';
import { AdCadence } from './ad-cadence';
import type { GameStore, SyncStorage } from './save';
import type { GameAnalytics } from './analytics';
interface View { playing: boolean; banner: boolean; completed: number; levelId: string; }
export class Monetization {
  enabled = { rewarded: false, interstitial: false, banner: false };
  busy = false;
  recoveryFailed = false;
  readonly cadence: AdCadence;
  private ads?: AdsBridge;
  private nativeBanner?: NativeBanner;
  private listener?: { remove(): Promise<void> };
  private recovery?: Promise<void>;
  private queue?: DurableReceiptQueue<AdReceipt>;
  private disposed = false;
  private refreshing = false;
  private statusSettled = false;
  private statusAttempts = 0;
  private preparedLevel = '';
  private view: View = { playing: false, banner: false, completed: 0, levelId: '' };
  constructor(private store: GameStore, storage: SyncStorage, private analytics: GameAnalytics,
    private block: (reason: string, value: boolean) => void, private quiesce: () => boolean,
    private refresh: () => void, private error: () => void, private slot: HTMLElement) {
    this.cadence = new AdCadence(storage);
  }
  async init(): Promise<void> {
    const ads = await createAdsBridge();
    if (this.disposed) { await ads.dispose(); return; }
    this.ads = ads;
    this.queue = new DurableReceiptQueue({
      commit: async r => {
        if (this.disposed || !validAdReceipt(r)) throw Error('Invalid or disposed reward');
        const result = this.store.commitAdReceipt(r);
        if (result === 'applied') this.analytics.event('ad_reward_granted', { placement: r.placement, amount: r.amount, recovered: !this.busy });
        return result;
      }, acknowledge: id => ads.acknowledge({ id }),
    });
    this.listener = await ads.addListener('adEvent', (e: AdEvent) => {
      if (this.disposed) return;
      this.analytics.event('ad_event', { format: e.kind, phase: e.phase });
      if (e.phase === 'earned') void this.recover().catch(() => {});
    });
    this.nativeBanner = new NativeBanner(ads, this.slot, this.refresh);
    await this.recover(); await this.refreshStatus();
  }
  async refreshStatus(): Promise<void> {
    if (!this.ads || this.disposed || this.refreshing || this.statusSettled) return;
    this.refreshing = true;
    if (++this.statusAttempts >= 30) this.statusSettled = true;
    try { const s = await this.ads.status(); if (!this.disposed) { this.statusSettled = this.statusSettled || s.mode === 'disabled' || s.mode === 'test' || Boolean(s.ready); if (JSON.stringify(s) !== JSON.stringify(this.enabled)) { this.enabled = s; this.refresh(); } } }
    catch { /* Native unavailable never prevents boot. */ }
    finally { this.refreshing = false; }
  }
  update(view: View): void {
    this.view = view;
    this.cadence.setActive(view.playing && !this.busy && !this.recoveryFailed);
    this.nativeBanner?.setVisible(this.enabled.banner && view.banner && !this.busy && !this.recoveryFailed);
    if (view.playing && this.enabled.interstitial && this.preparedLevel !== view.levelId && !this.busy) {
      this.preparedLevel = view.levelId; void this.ads?.prepareInterstitial().catch(() => {});
    }
  }
  tick(): void { this.cadence.tick(); }
  protect(levelId: string): void { this.cadence.protect(levelId); }
  async recover(): Promise<void> {
    if (this.recovery) return this.recovery;
    if (!this.ads || !this.queue || this.disposed) return;
    this.recovery = (async () => {
      this.block('ad-receipt', true);
      try {
        if (!this.quiesce()) throw Error('Cannot quiesce save');
        const { receipts } = await this.ads!.pending();
        if (this.disposed) return;
        for (const r of receipts) { if (!validAdReceipt(r)) throw Error('Invalid native receipt'); await this.queue!.deliver(r); }
        this.recoveryFailed = false; this.block('ad-recovery-error', false);
      } catch (e) { if (this.disposed) return; this.recoveryFailed = true; this.block('ad-recovery-error', true); this.error(); throw e; }
      finally { if (!this.disposed) { this.block('ad-receipt', false); this.refresh(); } }
    })().finally(() => { this.recovery = undefined; });
    return this.recovery;
  }
  async topup(placement: 'hint-coins' | 'theme-coins'): Promise<boolean> {
    if (!this.enabled.rewarded) return false;
    this.protect(this.view.levelId);
    this.analytics.event('ad_offer', { placement });
    const before = this.store.state.coins;
    await this.fullscreen('rewarded', placement);
    return this.store.state.coins > before;
  }
  async interstitial(levelId: string, first: boolean): Promise<void> {
    if (this.enabled.interstitial && this.cadence.eligible(this.view.completed, levelId, first)) await this.fullscreen('interstitial', 'continue');
  }
  private async fullscreen(kind: AdKind, placement: string): Promise<void> {
    if (!this.ads || this.busy || this.disposed || this.recoveryFailed || !this.quiesce()) return;
    this.busy = true; this.cadence.begin(this.view.completed); this.block('ad-fullscreen', true); this.refresh();
    let shown = false;
    try {
      const answer = await this.ads.show({ kind, placement, session: crypto.randomUUID() }); shown = answer.shown;
      if (this.disposed) return;
      await this.recover();
    } catch { if (!this.disposed && !this.recoveryFailed) this.analytics.event('ad_event', { format: kind, phase: 'show_error' }); }
    finally {
      this.cadence.end(this.view.completed, shown);
      this.preparedLevel = '';
      this.busy = false;
      if (!this.disposed) { this.block('ad-fullscreen', false); this.refresh(); }
    }
  }
  dispose(): void {
    this.disposed = true; this.cadence.setActive(false); this.nativeBanner?.dispose();
    void this.listener?.remove(); void this.ads?.dispose().catch(() => {});
  }
}
