import { DurableReceiptQueue } from '../../vendor/mini-games-kit/src/platform/durable-receipt-queue';
import { createAdsBridge, type AdsBridge, type AdEvent, type AdKind } from '../platform/ads';
import { NativeBanner } from '../platform/banner';
import { validAdReceipt, type AdReceipt } from '../core/monetization';
import { AdCadence } from './ad-cadence';
import type { GameStore, SyncStorage } from './save';
import type { GameAnalytics } from './analytics';
function adDeadline<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Native ad bridge deadline')), 5000);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
interface View { playing: boolean; banner: boolean; completed: number; levelId: string; }
export class Monetization {
  enabled = { rewarded: false, interstitial: false, banner: false };
  busy = false;
  readonly cadence: AdCadence;
  private ads?: AdsBridge;
  private nativeBanner?: NativeBanner;
  private listener?: { remove(): Promise<void> };
  private recovery?: Promise<void>;
  private queue?: DurableReceiptQueue<AdReceipt>;
  private disposed = false;
  private initializing?: Promise<void>;
  private retryAt = 0;
  private failures = 0;
  private refreshing = false;
  private statusSettled = false;
  private statusRetryAt = 0;
  private prepareRetryAt = 0;
  private pendingCall = false;
  private latePending?: { receipts: AdReceipt[] };
  private ackCalls = new Set<string>();
  private preparing = false;
  private preparedLevel = '';
  private view: View = { playing: false, banner: false, completed: 0, levelId: '' };
  constructor(private store: GameStore, storage: SyncStorage, private analytics: GameAnalytics,
    private block: (reason: string, value: boolean) => void, private quiesce: () => boolean,
    private refresh: () => void, private slot: HTMLElement) {
    this.cadence = new AdCadence(storage);
  }
  async init(): Promise<void> {
    if (this.initializing) return this.initializing;
    if (this.disposed || this.ads) return;
    this.initializing = (async () => { try {
      const ads = await adDeadline(createAdsBridge());
      if (this.disposed) { await ads.dispose(); return; }
      this.ads = ads;
      this.queue = new DurableReceiptQueue({
        commit: async r => {
          if (this.disposed || !validAdReceipt(r)) throw Error('Invalid or disposed reward');
          // No await between settling the latest route and the atomic wallet/ledger write.
          if (!this.quiesce()) throw Error('Cannot settle save');
          let result: 'applied' | 'already-applied';
          try { result = this.store.commitAdReceipt(r); }
          catch (e) { try { this.store.reload(); } catch { /* Preserve genuine save recovery gate. */ } throw e; }
          this.refresh();
          if (result === 'applied') this.analytics.event('ad_reward_granted', { placement: r.placement, amount: r.amount, recovered: !this.busy });
          return result;
        }, acknowledge: async id => {
          if (this.ackCalls.has(id)) throw Error('Ack still pending');
          this.ackCalls.add(id);
          await adDeadline(ads.acknowledge({ id }).finally(() => this.ackCalls.delete(id)));
        },
      });
      void ads.addListener('adEvent', (e: AdEvent) => {
        if (this.disposed) return;
        this.analytics.event('ad_event', { format: e.kind, phase: e.phase });
        if (e.phase === 'earned') void this.recover().catch(() => {});
      }).then(handle => { if (this.disposed) void handle.remove(); else this.listener = handle; }).catch(() => {});
      this.nativeBanner = new NativeBanner(ads, this.slot, this.refresh);
      void this.recover().catch(() => {}); void this.refreshStatus();
    } catch { this.retryLater(); }
    })().finally(() => { this.initializing = undefined; });
    return this.initializing;
  }
  private retryLater(): void {
    this.retryAt = Date.now() + Math.min(30000, 5000 * 2 ** Math.min(this.failures++, 3));
  }
  async refreshStatus(): Promise<void> {
    if (!this.ads || this.disposed || this.refreshing || this.statusSettled || Date.now() < this.statusRetryAt) return;
    this.refreshing = true;
    this.statusRetryAt = Date.now() + 10000;
    try {
      await adDeadline(this.ads.status().then(s => {
        if (this.disposed) return;
        this.statusSettled = s.mode === 'disabled' || s.mode === 'test' || Boolean(s.ready);
        if (JSON.stringify(s) !== JSON.stringify(this.enabled)) { this.enabled = s; this.refresh(); }
      }).finally(() => { this.refreshing = false; }));
    } catch { /* Native unavailable never prevents boot; at most one outstanding status RPC. */ }
  }
  private async pending(): Promise<{ receipts: AdReceipt[] }> {
    if (this.latePending) { const value = this.latePending; this.latePending = undefined; return value; }
    if (this.pendingCall) throw Error('Receipt query still pending');
    this.pendingCall = true;
    let expired = false;
    const operation = this.ads!.pending().then(value => {
      if (expired && !this.disposed) { this.latePending = value; this.retryAt = 0; }
      return value;
    }).finally(() => { this.pendingCall = false; });
    try { return await adDeadline(operation); }
    catch (e) { expired = true; throw e; }
  }
  update(view: View): void {
    this.view = view;
    this.cadence.setActive(view.playing && !this.busy);
    this.nativeBanner?.setVisible(this.enabled.banner && view.banner && !this.busy);
    if (view.playing && this.enabled.interstitial && (this.preparedLevel !== view.levelId || Date.now() >= this.prepareRetryAt) && !this.busy && !this.preparing) {
      this.preparing = true; this.preparedLevel = view.levelId; this.prepareRetryAt = Date.now() + 30000;
      void this.ads?.prepareInterstitial().catch(() => {}).finally(() => { this.preparing = false; });
    }
  }
  tick(): void {
    this.cadence.tick();
    this.update(this.view);
    if (!this.disposed && Date.now() >= this.retryAt && !this.recovery && !this.initializing)
      void this.recover().catch(() => {});
  }
  protect(levelId: string): void { this.cadence.protect(levelId); }
  async recover(): Promise<void> {
    if (this.recovery) return this.recovery;
    if (this.disposed) return;
    if (!this.ads || !this.queue) return this.init();
    this.recovery = (async () => {
      try {
        // Query and ack are optional network/native work, never gameplay blockers.
        const { receipts } = await this.pending();
        if (this.disposed) return;
        for (const r of receipts) { if (!validAdReceipt(r)) throw Error('Invalid native receipt'); await this.queue!.deliver(r); }
        this.failures = 0; this.retryAt = Date.now() + 30000;
      } catch (e) { this.retryLater(); throw e; }
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
    if (!this.ads || this.busy || this.disposed || !this.quiesce()) return;
    this.busy = true; this.cadence.begin(this.view.completed); this.block('ad-fullscreen', true); this.refresh();
    let shown = false;
    try {
      const answer = await this.ads.show({ kind, placement, session: crypto.randomUUID() }); shown = answer.shown;
      if (this.disposed) return;
      void this.recover().catch(() => {});
    } catch { if (!this.disposed) this.analytics.event('ad_event', { format: kind, phase: 'show_error' }); }
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
