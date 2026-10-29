import { describe, expect, it } from 'vitest';

import { MAX_RENDER_PIXEL_RATIO, getBackingStoreSize, resolveRenderPixelRatio } from '../src/core/index';

describe('render density', () => {
  it('keeps standard density at 1x and caps high density by default', () => {
    expect(resolveRenderPixelRatio(1)).toBe(1);
    expect(resolveRenderPixelRatio(0.75)).toBe(1);
    expect(resolveRenderPixelRatio(Number.NaN)).toBe(1);
    expect(resolveRenderPixelRatio(3)).toBe(MAX_RENDER_PIXEL_RATIO);
  });

  it('allows a consumer-specific cap', () => {
    expect(resolveRenderPixelRatio(2.5, 3)).toBe(2.5);
    expect(resolveRenderPixelRatio(4, 3)).toBe(3);
  });

  it('converts CSS dimensions to backing-store pixels', () => {
    expect(getBackingStoreSize(1280, 720, 1)).toEqual({ width: 1280, height: 720 });
    expect(getBackingStoreSize(1280, 720, 2)).toEqual({ width: 2560, height: 1440 });
  });
});
