import type Phaser from 'phaser';
import { tint, type Theme } from '../content/themes';

/** One chamfered diamond silhouette for board tokens and SVG thumbnails. */
export function diamondPoints(x: number, y: number, radius: number): { x: number; y: number }[] {
  return [[-.12, -.94], [.12, -.94], [.94, -.12], [.94, .12], [.12, .94], [-.12, .94], [-.94, .12], [-.94, -.12]]
    .map(([dx, dy]) => ({ x: x + dx * radius, y: y + dy * radius }));
}
export const diamondPath = (x: number, y: number, radius: number): string =>
  diamondPoints(x, y, radius).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('') + 'Z';

function fillDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number): void {
  const points = diamondPoints(x, y, radius);
  g.beginPath(); g.moveTo(points[0]!.x, points[0]!.y);
  for (const p of points.slice(1)) g.lineTo(p.x, p.y);
  g.closePath(); g.fillPath();
}

/** A small solid ivory token, never a reset arrow or the round route head. */
export function drawStartToken(g: Phaser.GameObjects.Graphics, x: number, y: number, cell: number, theme: Theme): void {
  const r = cell * .22, depth = Math.max(.7, cell * .032);
  g.fillStyle(tint(theme.ribbon, -.55), .35); fillDiamond(g, x, y + depth * 1.5, r * 1.06);
  g.fillStyle(0xdac8ae); fillDiamond(g, x, y + depth, r);
  g.fillStyle(0xfff7e8); fillDiamond(g, x, y, r);
  g.fillStyle(0xffffff); g.fillTriangle(x - r * .76, y, x, y - r * .84, x, y + r * .15);
  g.fillStyle(0xeaddc9); g.fillTriangle(x, y + r * .15, x + r * .8, y, x, y + r * .84);
  g.lineStyle(Math.max(.7, cell * .018), 0xffffff, .95); g.lineBetween(x - r * .64, y - r * .15, x - r * .15, y - r * .64);
}

/** A recessed gold socket. The final move seats the same ivory token in it. */
export function drawFinishSocket(g: Phaser.GameObjects.Graphics, x: number, y: number, cell: number, theme: Theme, filled: boolean): void {
  const r = cell * .405, depth = Math.max(.8, cell * .035);
  g.fillStyle(tint(theme.empty, -.35), .24); fillDiamond(g, x, y + depth, r * 1.06);
  g.fillStyle(0xbc8436); fillDiamond(g, x, y + depth * .65, r);
  g.fillStyle(0xedbc66); fillDiamond(g, x, y, r);
  g.fillStyle(0xffe4a6); g.fillTriangle(x - r * .9, y, x, y - r * .9, x, y);
  g.fillStyle(0xdba351); g.fillTriangle(x, y, x + r * .9, y, x, y + r * .9);
  g.fillStyle(tint(theme.empty, -.2)); fillDiamond(g, x, y + depth * .35, r * .73);
  g.fillStyle(filled ? tint(theme.ribbon, -.1) : tint(theme.empty, -.025)); fillDiamond(g, x, y + depth * .8, r * .65);
  g.lineStyle(Math.max(.8, cell * .023), 0xffefc7, .95);
  g.lineBetween(x - r * .75, y - r * .13, x - r * .13, y - r * .75);
  g.lineStyle(Math.max(.6, cell * .018), 0x93602a, .5);
  g.lineBetween(x + r * .13, y + r * .69, x + r * .69, y + r * .13);
  if (filled) drawStartToken(g, x, y + depth * .3, cell, theme);
}
