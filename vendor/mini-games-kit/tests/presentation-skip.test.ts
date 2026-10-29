import { describe, expect, it, vi } from 'vitest';

import { PresentationSkipController } from '../src/core/presentation-skip';

describe('PresentationSkipController', () => {
  it('skips exactly one registered presentation beat', () => {
    const controller = new PresentationSkipController();
    const action = vi.fn();
    controller.register(action);

    expect(controller.request(100)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(controller.request(101)).toBe(false);
  });

  it('honors a guard without consuming the active beat', () => {
    const controller = new PresentationSkipController();
    const action = vi.fn();
    controller.register(action);
    controller.guardUntilTime(220);

    expect(controller.request(219)).toBe(false);
    expect(controller.hasActiveBeat()).toBe(true);
    expect(controller.request(220)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not clear a newer beat when an older registration disposes', () => {
    const controller = new PresentationSkipController();
    const first = vi.fn();
    const second = vi.fn();
    const disposeFirst = controller.register(first);
    controller.register(second);

    disposeFirst();
    expect(controller.request(0)).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
