import { presentation } from '../config/presentation';

export interface BoardLayout {
  x: number; y: number; cell: number; gap: number; width: number; height: number;
}

/** Coordinates are CSS pixels in the board's own available rect, never native px. */
export function boardLayout(width: number, height: number, miniature = false): BoardLayout {
  const referenceScale = Math.min(width / 390, 1.5);
  const max = (miniature ? 22 : presentation.maxCell) * referenceScale;
  const cell = Math.max(1, Math.min(max, (width - 40) / (3 + 2 / 7), (height - 32) / (3 + 2 / 7)));
  const gap = cell * presentation.gapRatio;
  const size = cell * 3 + gap * 2;
  return { x: (width - size) / 2, y: (height - size) / 2, cell, gap, width: size, height: size };
}
