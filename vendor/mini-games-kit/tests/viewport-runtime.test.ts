import { describe, expect, it } from 'vitest';

import {
  resolveInitialLandscapeGameCssSize,
  resolveViewportState,
  shouldSyncLandscapeBackingStore,
} from '../src/layout/index';

describe('mobile viewport runtime', () => {
  it('ignores a stale portrait visualViewport when layout geometry already agrees on landscape', () => {
    expect(resolveViewportState(
      { width: 400, height: 800 },
      { width: 800, height: 400 },
      { width: 800, height: 400 },
      false,
    )).toEqual({ width: 800, height: 400, portrait: false });
  });

  it('uses matchMedia only as a tie-breaker while layout geometries disagree', () => {
    expect(resolveViewportState(
      { width: 800, height: 400 },
      { width: 400, height: 800 },
      { width: 800, height: 400 },
      true,
    )).toEqual({ width: 400, height: 800, portrait: true });
  });

  it('boots a landscape-only engine behind a portrait gate with provisional capped landscape geometry', () => {
    const viewport = { width: 390, height: 844, portrait: true };
    expect(resolveInitialLandscapeGameCssSize(viewport)).toEqual({ width: 780, height: 390 });
    expect(shouldSyncLandscapeBackingStore(viewport)).toBe(false);
  });
});
