import { cellRect, type BoardLayout } from '../ui/layout';
import type { Level } from './model';
export interface Point { x: number; y: number; }
function entry(a: Point, b: Point, r: { x: number; y: number; width: number; height: number }): number | null {
  let near = 0, far = 1;
  for (const [v, d, min, max] of [[a.x, b.x - a.x, r.x, r.x + r.width], [a.y, b.y - a.y, r.y, r.y + r.height]]) {
    if (Math.abs(d!) < 1e-9) { if (v! < min! || v! > max!) return null; continue; }
    const t1 = (min! - v!) / d!, t2 = (max! - v!) / d!;
    near = Math.max(near, Math.min(t1, t2)); far = Math.min(far, Math.max(t1, t2));
    if (near > far) return null;
  }
  return near;
}
/** Ordered inner-rectangle intersections, independent of pointer event frequency. */
export function crossedCells(level: Level, layout: BoardLayout, a: Point, b: Point): number[] {
  return level.cells.map(cell => {
    const r = cellRect(level, layout, cell), inset = layout.cell * 0.14;
    return { cell, t: entry(a, b, { x: r.x + inset, y: r.y + inset, width: r.width - 2 * inset, height: r.height - 2 * inset }) };
  }).filter((item): item is { cell: number; t: number } => item.t !== null).sort((a, b) => a.t - b.t).map(item => item.cell);
}
export function touchesHead(level: Level, layout: BoardLayout, cell: number, p: Point): boolean {
  const r = cellRect(level, layout, cell), pad = layout.cell * 0.1;
  return p.x >= r.x - pad && p.x <= r.x + r.width + pad && p.y >= r.y - pad && p.y <= r.y + r.height + pad;
}
