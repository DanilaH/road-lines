import type { BoardLayout } from '../ui/layout';
export function victoryLayout(from: BoardLayout, to: BoardLayout, elapsed: number): BoardLayout {
  const at = Math.max(0, Math.min(650, elapsed));
  if (at < 150) {
    const scale = 1 + .11 * Math.sin(at / 150 * Math.PI / 2);
    return { ...from, x: from.x - from.width * (scale - 1) / 2, y: from.y - from.height * (scale - 1) / 2,
      cell: from.cell * scale, gap: from.gap * scale, width: from.width * scale, height: from.height * scale };
  }
  const t = 1 - (1 - (at - 150) / 500) ** 3;
  const start = { ...from, x: from.x - from.width * .055, y: from.y - from.height * .055,
    cell: from.cell * 1.11, gap: from.gap * 1.11, width: from.width * 1.11, height: from.height * 1.11 };
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return { ...to, x: lerp(start.x, to.x), y: lerp(start.y, to.y), cell: lerp(start.cell, to.cell),
    gap: lerp(start.gap, to.gap), width: lerp(start.width, to.width), height: lerp(start.height, to.height) };
}

/** A single arc-length phase for the whole polyline, including corner clearances. */
export function routeDots(points: readonly { x: number; y: number }[], spacing: number, radius: number): { x: number; y: number }[] {
  if (points.length < 2 || spacing <= 0) return [];
  const segments = points.slice(1).map((b, i) => { const a = points[i]!; return { a, b, length: Math.hypot(b.x - a.x, b.y - a.y) }; });
  const total = segments.reduce((n, s) => n + s.length, 0), out: { x: number; y: number }[] = [];
  let offset = 0, target = spacing / 2;
  for (const s of segments) {
    if (!s.length) continue;
    while (target < offset + s.length && target < total - spacing / 2) {
      const t = (target - offset) / s.length, point = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
      // At a right-angle bend arc-distance alone can make two dots look crowded.
      // Keep phase; omit a dot instead of moving/restarting the downstream pattern.
      const previous = out.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= radius * 3) out.push(point);
      target += spacing;
    }
    offset += s.length;
  }
  return out;
}
