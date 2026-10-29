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
