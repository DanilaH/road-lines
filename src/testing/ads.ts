// Only dynamically imported in the explicit ads-test compile mode; stripped from normal production.
import type { AdsBridge, AdEvent } from '../platform/ads';
import type { AdReceipt } from '../core/monetization';
export function testAds(): AdsBridge {
  const listeners = new Set<(e: AdEvent) => void>();
  const emit = (kind: AdEvent['kind'], phase: AdEvent['phase']) => listeners.forEach(f => f({ kind, phase }));
  let live = true;
  const mode = new URLSearchParams(location.search).get('ad') ?? 'earned';
  return {
    status: async () => mode === 'startup-status-hang' ? new Promise(() => {}) : ({ banner: true, rewarded: true, interstitial: true, mode: 'test' }),
    prepareInterstitial: async () => {},
    show: async ({ kind, session, placement }) => {
      emit(kind, 'request');
      if (mode === 'unavailable') { emit(kind, 'load_error'); return { shown: false, outcome: 'unavailable' }; }
      emit(kind, 'loaded'); emit(kind, 'show');
      await new Promise(r => setTimeout(r, 250));
      if (kind === 'rewarded' && mode !== 'dismiss') {
        const sequence = Number(localStorage.getItem('test-ad-seq') ?? 0) + 1;
        const r: AdReceipt = { schema: 1, id: session, session, stream: 'test-stream', sequence, amount: 150, placement: placement as AdReceipt['placement'] };
        localStorage.setItem('test-ad-seq', String(sequence)); localStorage.setItem('test-ad-pending', JSON.stringify(r));
        if (live && mode !== 'crash') emit(kind, 'earned');
      }
      if (mode === 'crash') { location.reload(); return new Promise(() => {}); }
      await new Promise(r => setTimeout(r, 250)); if (live) emit(kind, 'dismiss');
      return { shown: true, outcome: 'dismissed' };
    },
    pending: async () => { if (mode === 'startup-pending-error') throw Error('Offline'); if (mode === 'startup-pending-hang') return new Promise(() => {}); if (mode === 'startup-pending-delay') await new Promise(r=>setTimeout(r,650)); return ({ receipts: localStorage.getItem('test-ad-pending') ? [JSON.parse(localStorage.getItem('test-ad-pending')!)] : [] }); },
    acknowledge: async ({ id }) => { if (mode === 'ack-hang') return new Promise(() => {}); const raw = localStorage.getItem('test-ad-pending'); if (raw && JSON.parse(raw).id !== id) throw Error('Ack mismatch'); localStorage.removeItem('test-ad-pending'); },
    measureBanner: async ({ slotWidth }) => ({ webView: { x: 0, y: 0, width: innerWidth, height: innerHeight }, root: { width: innerWidth, height: innerHeight }, adHeight: mode === 'large-banner' ? 90 : 50 }),
    placeBanner: async () => { localStorage.setItem('test-banner-state','visible'); }, hideBanner: async () => { localStorage.setItem('test-banner-state','hidden'); }, dispose: async () => { live = false; listeners.clear(); },
    addListener: async (_name, cb) => { listeners.add(cb); return { remove: async () => { listeners.delete(cb); } }; },
  };
}
