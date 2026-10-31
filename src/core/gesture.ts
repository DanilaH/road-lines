import { cellRect, type BoardLayout } from '../ui/layout';
import type { Level } from './model';
export interface Point { x: number; y: number; }
function entry(a: Point, b: Point, r: { x: number; y: number; width: number; height: number }): number | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < 1e-9 && (a.x < r.x || a.x > r.x + r.width)) return null;
  if (Math.abs(dy) < 1e-9 && (a.y < r.y || a.y > r.y + r.height)) return null;
  const tx1 = Math.abs(dx) < 1e-9 ? -Infinity : (r.x - a.x) / dx, tx2 = Math.abs(dx) < 1e-9 ? Infinity : (r.x + r.width - a.x) / dx;
  const ty1 = Math.abs(dy) < 1e-9 ? -Infinity : (r.y - a.y) / dy, ty2 = Math.abs(dy) < 1e-9 ? Infinity : (r.y + r.height - a.y) / dy;
  const near = Math.max(0, Math.min(tx1, tx2), Math.min(ty1, ty2)), far = Math.min(1, Math.max(tx1, tx2), Math.max(ty1, ty2));
  return near <= far ? near : null;
}
const hitRects = new WeakMap<BoardLayout, { level: Level; cells: { cell: number; rect: { x: number; y: number; width: number; height: number } }[] }>();
/** Ordered inner-rectangle intersections, independent of pointer event frequency. */
export function crossedCells(level: Level, layout: BoardLayout, a: Point, b: Point): number[] {
  let cached = hitRects.get(layout);
  if (!cached || cached.level !== level) {
    const inset = layout.cell * .14;
    cached = { level, cells: level.cells.map(cell => { const r = cellRect(level, layout, cell);
      return { cell, rect: { x: r.x + inset, y: r.y + inset, width: r.width - 2 * inset, height: r.height - 2 * inset } }; }) };
    hitRects.set(layout, cached);
  }
  const hits: { cell: number; t: number }[] = [];
  for (const c of cached.cells) { const t = entry(a, b, c.rect); if (t !== null) hits.push({ cell: c.cell, t }); }
  return hits.sort((a, b) => a.t - b.t).map(c => c.cell);
}
export function touchesHead(level: Level, layout: BoardLayout, cell: number, p: Point): boolean {
  const r = cellRect(level, layout, cell), pad = layout.cell * 0.1;
  return p.x >= r.x - pad && p.x <= r.x + r.width + pad && p.y >= r.y - pad && p.y <= r.y + r.height + pad;
}
