import { resolveNativeBannerPlacement } from '../../vendor/mini-games-kit/src/layout/native-banner-placement';
import type { AdsBridge } from './ads';
/** Coalesced geometry requests. Native also checks generations, visibility and actual WebView bounds. */
export class NativeBanner {
  private generation = 0;
  private frame = 0;
  private disposed = false;
  private visible = false;
  private observer: ResizeObserver;
  private key = '';
  constructor(private ads: AdsBridge, private slot: HTMLElement, private onReserve: () => void) {
    this.observer = new ResizeObserver(() => this.schedule()); this.observer.observe(slot);
  }
  setVisible(visible: boolean): void {
    if (this.visible === visible) { if (visible) this.schedule(); return; }
    this.visible = visible; this.key = ''; this.generation++;
    if (!visible) void this.ads.hideBanner().catch(() => {}); else this.schedule();
  }
  schedule(): void {
    if (this.frame || !this.visible || this.disposed) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; void this.layout(); });
  }
  private async layout(): Promise<void> {
    const generation = ++this.generation;
    const rect = this.slot.getBoundingClientRect();
    const viewport = { width: innerWidth, height: innerHeight };
    const key = [rect.x,rect.y,rect.width,rect.height,viewport.width,viewport.height].join(':');
    if (key === this.key || rect.width <= 0 || rect.height <= 0) return;
    try {
      const measurement = await this.ads.measureBanner({ viewportWidth: viewport.width, slotWidth: rect.width });
      if (!measurement || this.disposed || !this.visible || generation !== this.generation) return;
      const placement = resolveNativeBannerPlacement({ ...measurement, slot: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport });
      if (placement.kind === 'reserve') {
        if (placement.heightCss > 100 || innerHeight < 680) { this.setVisible(false); return; }
        this.slot.style.height = `${placement.heightCss}px`; this.onReserve(); this.schedule(); return;
      }
      this.key = key;
      await this.ads.placeBanner({ placement, generation });
    } catch { /* A failed banner never blocks play or retries in a tight loop. */ }
  }
  dispose(): void { this.disposed = true; this.generation++; cancelAnimationFrame(this.frame); this.observer.disconnect(); void this.ads.hideBanner().catch(() => {}); }
}
