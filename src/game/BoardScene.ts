import Phaser from 'phaser';
import { presentation } from '../config/presentation';
import { levels } from '../content/levels';
import type { Level } from '../core/model';
import { boardLayout, cellRect, type BoardLayout } from '../ui/layout';
import { victoryLayout } from '../presentation/geometry';

export class BoardScene extends Phaser.Scene {
  private miniature = false;
  private drawing?: Phaser.GameObjects.Graphics;
  private renderRatio = 1;
  private level: Level = levels[0]!;
  private route: readonly number[] = [this.level.start];
  private hint: readonly number[] = [];
  private opening = 0;
  private pulse: { cell: number; at: number } | null = null;
  private winning: { from: BoardLayout; at: number } | null = null;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor() { super('Board'); }
  create(): void {
    this.drawing = this.add.graphics();
    this.scale.on('resize', this.redraw, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.redraw, this));
    this.redraw();
  }
  setState(level: Level, route: readonly number[], hint: readonly number[], miniature: boolean): void {
    this.level = level; this.route = route; this.hint = hint; this.miniature = miniature; this.redraw();
  }
  open(): void { this.opening = this.reduced ? 0 : performance.now(); this.pulse = null; this.redraw(); }
  react(cell: number): void { this.opening = 0; this.pulse = { cell, at: performance.now() }; this.redraw(); }
  win(from: BoardLayout): void { this.opening = 0; this.pulse = null; this.winning = { from, at: performance.now() }; this.redraw(); }
  settle(): void { this.opening = 0; this.pulse = null; this.winning = null; this.redraw(); }
  update(): void {
    const now = performance.now();
    if (this.opening && now - this.opening > 520) this.opening = 0;
    if (this.pulse && now - this.pulse.at > 160) this.pulse = null;
    if (this.opening || this.pulse || this.winning) this.redraw();
  }
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
    for (const [index, cell] of this.level.cells.entries()) {
      const t = Math.max(0, Math.min(1, (age - index * 7) / 220));
      const r = scaleRect(rect(cell), 1 - (1 - t) ** 3); g.fillStyle(presentation.empty); g.fillRect(r.x, r.y, r.width, r.height);
    }
    const ribbon = (path: readonly number[], color: number, alpha = 1): void => {
      g.fillStyle(color, alpha);
      for (const cell of path) {
        let r = rect(cell);
        if (this.opening) r = scaleRect(r, Math.max(0, Math.min(1, (age - 150) / 170)));
        if (this.pulse?.cell === cell && !this.reduced) r = scaleRect(r, 1 + .07 * Math.sin(Math.min(1, (now - this.pulse.at) / 160) * Math.PI));
        const inset = path === this.route && path.length === 1 ? r.width * 0.08 : 0;
        g.fillRect(r.x + inset, r.y + inset, r.width - inset * 2, r.height - inset * 2);
      }
      for (let i = 1; i < path.length; i++) {
        const a = rect(path[i - 1]!), b = rect(path[i]!);
        if (a.x === b.x) g.fillRect(a.x, Math.min(a.y, b.y), a.width, Math.abs(a.y - b.y) + a.height);
        else g.fillRect(Math.min(a.x, b.x), a.y, Math.abs(a.x - b.x) + a.width, a.height);
      }
    };
    if (this.hint.length) ribbon(this.hint, presentation.fill, 0.25);
    ribbon(this.route, presentation.fill);
    g.fillStyle(0xffffff, 0.72);
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
      g.lineStyle(2.4, 0xffffff, 0.95); g.beginPath(); g.arc(cx, cy, layout.cell * 0.18, 0.4, 5.3); g.strokePath();
      g.fillStyle(0xffffff); g.fillTriangle(cx + layout.cell * 0.15, cy - layout.cell * 0.18,
        cx + layout.cell * 0.15, cy - layout.cell * 0.02, cx + layout.cell * 0.28, cy - layout.cell * 0.13);
      if (this.route.length > 1) {
        const head = rect(this.route[this.route.length - 1]!);
        g.lineStyle(2.2, 0xffffff, 0.95); g.strokeCircle(head.x + head.width / 2, head.y + head.height / 2, layout.cell * 0.13);
      }
    }
  }
}
