import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameplayActivityCoordinator } from '../vendor/mini-games-kit/src/platform/activity';
const native = vi.hoisted(() => ({ listeners: new Map<string, (state: { isActive: boolean }) => void>(), removed: [] as string[] }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/app', () => ({ App: {
  addListener: async (name: string, callback: (state: { isActive: boolean }) => void) => {
    native.listeners.set(name, callback);
    return { remove: async () => { native.removed.push(name); native.listeners.delete(name); } };
  },
  getState: async () => ({ isActive: true }),
} }));
import { installRuntime } from '../src/platform/runtime';
afterEach(() => { vi.unstubAllGlobals(); native.listeners.clear(); native.removed.length = 0; });
describe('background presentation lifecycle', () => {
  it('keeps animations backgrounded until both native and document blockers clear, even behind a modal', async () => {
    const document = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('document', document); vi.stubGlobal('window', new EventTarget());
    const activity = new GameplayActivityCoordinator(() => {}, () => {}), background = vi.fn();
    activity.setBlocked('modal', true);
    const dispose = await installRuntime(activity, () => {}, background);
    native.listeners.get('appStateChange')!({ isActive: false });
    document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    native.listeners.get('appStateChange')!({ isActive: true });
    expect(background).toHaveBeenLastCalledWith(true);
    document.hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(background).toHaveBeenLastCalledWith(false);
    expect(activity.isBlocked()).toBe(true);
    dispose();
    const calls = background.mock.calls.length;
    document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    expect(background.mock.calls.length).toBe(calls);
    expect(native.removed).toEqual(['appStateChange', 'backButton']);
  });
});
