import { presentation } from '../config/presentation';
import type { Level } from '../core/model';
export interface BoardLayout {
  x: number; y: number; cell: number; gap: number; width: number; height: number; minX: number; minY: number;
}
const bounds = new WeakMap<Level, { minX: number; minY: number; columns: number; rows: number }>();
export function boardLayout(width: number, height: number, miniature = false, level?: Level): BoardLayout {
  let box = level ? bounds.get(level) : undefined;
  if (!box) {
    const xs = level?.cells.map(c => c % level.width) ?? [0, 2], ys = level?.cells.map(c => Math.floor(c / level.width)) ?? [0, 2];
    const minX = Math.min(...xs), minY = Math.min(...ys);
    box = { minX, minY, columns: Math.max(...xs) - minX + 1, rows: Math.max(...ys) - minY + 1 };
    if (level) bounds.set(level, box);
  }
  const { minX, minY, columns, rows } = box;
  const referenceScale = Math.min(width / 390, 1.5);
  const max = (miniature ? 22 : presentation.maxCell) * referenceScale;
  const cell = Math.max(1, Math.min(max, (width - 40) / (columns + (columns - 1) / 7), (height - 64) / (rows + (rows - 1) / 7)));
  const gap = cell * presentation.gapRatio;
  const w = cell * columns + gap * (columns - 1), h = cell * rows + gap * (rows - 1);
  return { x: (width - w) / 2, y: (height - h) / 2, cell, gap, width: w, height: h, minX, minY };
}
export function cellRect(level: Level, layout: BoardLayout, cell: number): { x: number; y: number; width: number; height: number } {
  return { x: layout.x + (cell % level.width - layout.minX) * (layout.cell + layout.gap),
    y: layout.y + (Math.floor(cell / level.width) - layout.minY) * (layout.cell + layout.gap), width: layout.cell, height: layout.cell };
}

/** One last viewport state per consumer, not an unbounded dimensions cache. */
export function layoutReader(): typeof boardLayout {
  let last: { width: number; height: number; miniature: boolean; level?: Level; value: BoardLayout } | undefined;
  return (width, height, miniature = false, level) => {
    if (!last || last.width !== width || last.height !== height || last.miniature !== miniature || last.level !== level)
      last = { width, height, miniature, level, value: boardLayout(width, height, miniature, level) };
    return last.value;
  };
}
