import type Phaser from 'phaser';
type Rect = { x: number; y: number; width: number; height: number };
export type Corners = { tl?: number; tr?: number; bl?: number; br?: number };

/** Phaser gradients shade each path triangle separately. Use rectangular bands
 * inside a solid rounded silhouette to avoid diagonal seams on rounded faces. */
export function shadedRect(g: Phaser.GameObjects.Graphics, r: Rect, radius: number | Corners,
  tone: (y: number) => number, alpha = 1): void {
  if (r.width <= 0 || r.height <= 0) return;
  if (alpha < 1) { g.fillStyle(tone(r.y + r.height / 2), alpha); g.fillRoundedRect(r.x, r.y, r.width, r.height, radius); return; }
  const c = typeof radius === 'number' ? { tl: radius, tr: radius, bl: radius, br: radius } : { tl: 0, tr: 0, bl: 0, br: 0, ...radius };
  g.fillStyle(tone(r.y), alpha); g.fillRoundedRect(r.x, r.y, r.width, r.height, c);
  g.fillStyle(tone(r.y + r.height), alpha);
  g.fillRoundedRect(r.x, r.y + r.height / 2, r.width, r.height / 2, { tl: 0, tr: 0, bl: c.bl, br: c.br });
  const band = (x: number, y: number, width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    g.fillStyle(tone(y), alpha);
    g.fillGradientStyle(tone(y), tone(y), tone(y + height), tone(y + height), alpha);
    g.fillRect(x, y, width, height);
  };
  const left = Math.max(c.tl, c.bl), right = Math.max(c.tr, c.br);
  band(r.x + left, r.y, r.width - left - right, r.height);
  band(r.x, r.y + c.tl, left, r.height - c.tl - c.bl);
  band(r.x + r.width - right, r.y + c.tr, right, r.height - c.tr - c.br);
}
