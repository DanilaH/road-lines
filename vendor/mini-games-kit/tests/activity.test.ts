import { describe, expect, it, vi } from 'vitest';

import {
  GameplayActivityCoordinator,
  installViewportOrientationBlocker,
  type ViewportSizeSource,
} from '../src/platform/index';

describe('GameplayActivityCoordinator', () => {
  it('does not resume until every blocker is removed', () => {
    const start = vi.fn();
    const stop = vi.fn();
    const activity = new GameplayActivityCoordinator(start, stop);

    activity.setGameplayDesired(true);
    activity.setBlocked('ad', true);
    activity.setBlocked('platform', true);
    activity.setBlocked('ad', false);
    expect(start).toHaveBeenCalledTimes(1);
    activity.setBlocked('platform', false);
    expect(start).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('replays current aggregate state to a late subscriber', () => {
    const activity = new GameplayActivityCoordinator(() => undefined, () => undefined);
    activity.setBlocked('platform', true);
    const listener = vi.fn();
    activity.onBlockedChange(listener);
    expect(listener.mock.calls).toEqual([[true]]);
    activity.setBlocked('platform', false);
    expect(listener.mock.calls).toEqual([[true], [false]]);
  });

  it('bridges viewport orientation into a semantic blocker and cleans up the resize listener', () => {
    const activity = new GameplayActivityCoordinator(() => undefined, () => undefined);
    let resizeListener: (() => void) | null = null;
    const viewport: ViewportSizeSource = {
      innerWidth: 600,
      innerHeight: 900,
      addEventListener: (_type, listener) => {
        resizeListener = listener;
      },
      removeEventListener: (_type, listener) => {
        if (resizeListener === listener) resizeListener = null;
      },
    };
    const onChange = vi.fn();

    const dispose = installViewportOrientationBlocker(activity, viewport, { onChange });
    expect(activity.isBlocked()).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(true);

    viewport.innerWidth = 1000;
    viewport.innerHeight = 700;
    expect(resizeListener).not.toBeNull();
    (resizeListener as unknown as () => void)();
    expect(activity.isBlocked()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(false);

    dispose();
    expect(resizeListener).toBeNull();
  });
});
