export const MAX_RENDER_PIXEL_RATIO = 2;

export const resolveRenderPixelRatio = (
  value: number,
  maxPixelRatio = MAX_RENDER_PIXEL_RATIO,
): number => {
  const safeValue = Number.isFinite(value) ? value : 1;
  const safeMax = Math.max(1, Number.isFinite(maxPixelRatio) ? maxPixelRatio : MAX_RENDER_PIXEL_RATIO);
  return Math.min(safeMax, Math.max(1, safeValue));
};

export const getRenderPixelRatio = (maxPixelRatio = MAX_RENDER_PIXEL_RATIO): number => {
  if (typeof window === 'undefined') return 1;
  return resolveRenderPixelRatio(window.devicePixelRatio || 1, maxPixelRatio);
};

export const getBackingStoreSize = (
  cssWidth: number,
  cssHeight: number,
  pixelRatio = getRenderPixelRatio(),
): { width: number; height: number } => {
  const ratio = resolveRenderPixelRatio(pixelRatio, Math.max(1, pixelRatio));
  return {
    width: Math.max(1, Math.round(Math.max(1, cssWidth) * ratio)),
    height: Math.max(1, Math.round(Math.max(1, cssHeight) * ratio)),
  };
};
