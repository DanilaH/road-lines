import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { AdReceipt } from '../core/monetization';
import type { NativeBannerPlacementInput, NativeBannerPlacement } from '../../vendor/mini-games-kit/src/layout/native-banner-placement';
export type AdKind = 'interstitial' | 'rewarded';
export interface AdEvent { kind: AdKind | 'banner'; phase: 'request' | 'loaded' | 'load_error' | 'show' | 'impression' | 'earned' | 'dismiss' | 'show_error'; }
export interface AdOutcome { shown: boolean; outcome: 'dismissed' | 'unavailable' | 'error' | 'cancelled'; }
export interface AdsBridge {
  status(): Promise<{ rewarded: boolean; interstitial: boolean; banner: boolean; mode: string; ready?: boolean }>;
  prepareInterstitial(): Promise<void>;
  show(o: { kind: AdKind; placement: string; session: string }): Promise<AdOutcome>;
  pending(): Promise<{ receipts: AdReceipt[] }>;
  acknowledge(o: { id: string }): Promise<void>;
  measureBanner(o: { viewportWidth: number; slotWidth: number }): Promise<Omit<NativeBannerPlacementInput, 'slot' | 'viewport'> | null>;
  placeBanner(o: { placement: NativeBannerPlacement; generation: number }): Promise<void>;
  hideBanner(): Promise<void>;
  dispose(): Promise<void>;
  addListener(name: 'adEvent', cb: (e: AdEvent) => void): Promise<PluginListenerHandle>;
}
const unavailable: AdsBridge = {
  status: async () => ({ rewarded: false, interstitial: false, banner: false, mode: 'disabled' }),
  prepareInterstitial: async () => {}, show: async () => ({ shown: false, outcome: 'unavailable' }),
  pending: async () => ({ receipts: [] }), acknowledge: async () => {}, measureBanner: async () => null,
  placeBanner: async () => {}, hideBanner: async () => {}, dispose: async () => {}, addListener: async () => ({ remove: async () => {} }),
};
export async function createAdsBridge(): Promise<AdsBridge> {
  if (import.meta.env.MODE === 'ads-test') return (await import('../testing/ads')).testAds();
  return Capacitor.isNativePlatform() ? registerPlugin<AdsBridge>('RoadAds') : unavailable;
}
