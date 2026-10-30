import Phaser from 'phaser';
import { defaultTheme, colorNumber, tint, type Theme } from '../content/themes';
import { levels } from '../content/levels';
import type { Level } from '../core/model';
import { boardLayout, cellRect, type BoardLayout } from '../ui/layout';
import { victoryLayout } from '../presentation/geometry';

export class BoardScene extends Phaser.Scene {
  private theme: Theme = defaultTheme;
  private miniature = false;
  private drawing?: Phaser.GameObjects.Graphics;
  private renderRatio = 1;
  private level: Level = levels[0]!;
  private route: readonly number[] = [this.level.start];
  private hint: readonly number[] = [];
  private opening = 0;
  private sparks: { cell: number; at: number; angle: number; speed: number }[] = [];
  private pulse: { cell: number; at: number } | null = null;
  private winning: { from: BoardLayout; at: number } | null = null;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor() { super('Board'); }
  create(): void {
    this.drawing = this.add.graphics();
    this.scale.on('resize', this.redraw, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.redraw, this); this.sparks = []; });
    this.redraw();
  }
  setState(level: Level, route: readonly number[], hint: readonly number[], miniature: boolean): void {
    if (this.level.id !== level.id) this.sparks = [];
    this.level = level; this.route = route; this.hint = hint; this.miniature = miniature; this.redraw();
  }
  open(): void { this.opening = this.reduced ? 0 : performance.now(); this.pulse = null; this.sparks = []; this.redraw(); }
  react(cell: number, reverse = false): void {
    this.opening = 0; this.pulse = { cell, at: performance.now() };
    if (!this.reduced && !reverse) for (let i = 0; i < 6 && this.sparks.length < 36; i++)
      this.sparks.push({ cell, at: performance.now(), angle: i * Math.PI / 3 + Math.random() * .4, speed: .45 + Math.random() * .3 });
    this.redraw();
  }
  win(from: BoardLayout): void { this.opening = 0; this.pulse = null; this.winning = { from, at: performance.now() }; this.redraw(); }
  settle(): void { this.opening = 0; this.pulse = null; this.winning = null; this.sparks = []; this.redraw(); }
  update(): void {
    const now = performance.now(), wasAnimating = Boolean(this.opening || this.pulse || this.winning || this.sparks.length);
    this.sparks = this.sparks.filter(s => now - s.at < 380);
    if (this.opening && now - this.opening > 520) this.opening = 0;
    if (this.pulse && now - this.pulse.at > 160) this.pulse = null;
    if (wasAnimating) this.redraw();
  }
  setTheme(theme: Theme): void { this.theme = theme; this.redraw(); }
  setRenderRatio(value: number): void { this.renderRatio = value; this.redraw(); }
  private redraw(): void {
    const g = this.drawing;
    if (!g) return;
    g.clear(); g.setScale(this.renderRatio);
    let layout = boardLayout(this.scale.width / this.renderRatio, this.scale.height / this.renderRatio, this.miniature, this.level);
    if (this.winning) {
      layout.y += this.scale.height / this.renderRatio * .01;
      layout = victoryLayout(this.winning.from, layout, this.reduced ? 650 : performance.now() - this.winning.at);
    }
    const now = performance.now(), age = this.opening ? now - this.opening : 1000;
    const scaleRect = (r: { x: number; y: number; width: number; height: number }, scale: number) => ({
      x: r.x + r.width * (1 - scale) / 2, y: r.y + r.height * (1 - scale) / 2, width: r.width * scale, height: r.height * scale });
    const rect = (cell: number) => cellRect(this.level, layout, cell);
    const surface = (r: { x: number; y: number; width: number; height: number }, alpha: number): void => {
      const tone = (y: number) => tint(this.theme.ribbon, .17 - Math.max(0, Math.min(1, (y - layout.y) / Math.max(1, layout.height))) * .29);
      g.fillStyle(colorNumber(this.theme.ribbon), alpha); // Solid fallback for Canvas renderer.
      g.fillGradientStyle(tone(r.y), tone(r.y), tone(r.y + r.height), tone(r.y + r.height), alpha);
      g.fillRect(r.x, r.y, r.width, r.height);
    };
    for (const [index, cell] of this.level.cells.entries()) {
      const t = Math.max(0, Math.min(1, (age - index * 7) / 220));
      const r = scaleRect(rect(cell), 1 - (1 - t) ** 3);
      g.fillStyle(tint(this.theme.empty, -.15), .3); g.fillRect(r.x, r.y + (this.miniature ? 1 : 3), r.width, r.height);
      g.fillStyle(colorNumber(this.theme.empty));
      g.fillGradientStyle(tint(this.theme.empty, .20), tint(this.theme.empty, .12), colorNumber(this.theme.empty), tint(this.theme.empty, -.025));
      g.fillRect(r.x, r.y, r.width, r.height);
    }
    const ribbon = (path: readonly number[], color: number, alpha = 1): void => {
      const fill = (x: number, y: number, width: number, height: number): void => {
        if (path === this.route) surface({ x, y, width, height }, alpha);
        else { g.fillStyle(color, alpha); g.fillRect(x, y, width, height); }
      };
      for (const cell of path) {
        let r = rect(cell);
        if (this.opening) r = scaleRect(r, Math.max(0, Math.min(1, (age - 150) / 170)));
        if (this.pulse?.cell === cell && !this.reduced) r = scaleRect(r, 1 + .07 * Math.sin(Math.min(1, (now - this.pulse.at) / 160) * Math.PI));
        const inset = path === this.route && path.length === 1 ? r.width * 0.08 : 0;
        fill(r.x + inset, r.y + inset, r.width - inset * 2, r.height - inset * 2);
      }
      for (let i = 1; i < path.length; i++) {
        const a = rect(path[i - 1]!), b = rect(path[i]!);
        if (a.x === b.x) fill(a.x, Math.min(a.y, b.y), a.width, Math.abs(a.y - b.y) + a.height);
        else fill(Math.min(a.x, b.x), a.y, Math.abs(a.x - b.x) + a.width, a.height);
      }
    };
    if (this.hint.length) ribbon(this.hint, colorNumber(this.theme.ribbon), 0.25);
    ribbon(this.route, colorNumber(this.theme.ribbon));
    for (const spark of this.sparks) {
      const t = Math.min(1, (now - spark.at) / 380), r = rect(spark.cell), distance = r.width * (0.30 + t * spark.speed);
      const x = r.x + r.width / 2 + Math.cos(spark.angle) * distance, y = r.y + r.height / 2 + Math.sin(spark.angle) * distance - t * r.height * .2;
      g.fillStyle(colorNumber(this.theme.ribbon), (1 - t) * .8); g.fillCircle(x, y, (1 - t) * 2.4 + .5);
    }
    if (this.pulse && !this.reduced && !this.miniature) {
      const r = rect(this.pulse.cell), t = Math.min(1, (now - this.pulse.at) / 160);
      g.lineStyle(2 * (1 - t), colorNumber(this.theme.trail), (1 - t) * .65);
      g.strokeCircle(r.x + r.width / 2, r.y + r.height / 2, r.width * (.19 + t * .26));
    }
    g.fillStyle(colorNumber(this.theme.trail), 0.9);
    for (let i = 1; i < this.route.length; i++) {
      const a = rect(this.route[i - 1]!), b = rect(this.route[i]!);
      const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      for (let d = 0; d < distance; d += this.miniature ? 5 : 8) {
        const t = d / distance;
        g.fillCircle(a.x + (b.x - a.x) * t + a.width / 2, a.y + (b.y - a.y) * t + a.height / 2, this.miniature ? 0.8 : 1.2);
      }
    }
    if (!this.miniature && (!this.opening || age > 170)) {
      const start = rect(this.level.start), cx = start.x + start.width / 2, cy = start.y + start.height / 2;
      g.lineStyle(2.4, colorNumber(this.theme.trail), 0.95); g.beginPath(); g.arc(cx, cy, layout.cell * 0.18, 0.4, 5.3); g.strokePath();
      g.fillStyle(colorNumber(this.theme.trail)); g.fillTriangle(cx + layout.cell * 0.15, cy - layout.cell * 0.18,
        cx + layout.cell * 0.15, cy - layout.cell * 0.02, cx + layout.cell * 0.28, cy - layout.cell * 0.13);
      if (this.route.length > 1) {
        const head = rect(this.route[this.route.length - 1]!);
        g.lineStyle(2.2, colorNumber(this.theme.trail), 0.95); g.strokeCircle(head.x + head.width / 2, head.y + head.height / 2, layout.cell * 0.13);
      }
    }
  }
}
