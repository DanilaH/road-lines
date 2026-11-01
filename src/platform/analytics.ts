import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AnalyticsAdapter, AnalyticsParams } from '../../vendor/mini-games-kit/src/platform/analytics';
interface NativeAnalytics { report(options: { event: string; params: AnalyticsParams }): Promise<void>; }
const native = registerPlugin<NativeAnalytics>('RoadAnalytics');
export function createAnalyticsAdapter(): AnalyticsAdapter {
  // Build-only diagnostic sink; never selectable via URL, storage, or window globals.
  if (import.meta.env.MODE === 'analytics-test') return { track: (event, params) => console.info('__ROAD_EVENT__' + JSON.stringify({ event, params })) };
  if (!Capacitor.isNativePlatform()) return { track() {} };
  let pending = 0;
  return { track(event, params = {}) {
    if (pending >= 32) return;
    pending++;
    try { void native.report({ event, params }).catch(() => {}).finally(() => { pending--; }); }
    catch { pending--; }
  } };
}
