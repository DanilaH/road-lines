import Phaser from 'phaser';
import { defaultTheme, colorNumber, tint, type Theme } from '../content/themes';
import { levels } from '../content/levels';
import type { Level } from '../core/model';
import { boardLayout, cellRect, type BoardLayout } from '../ui/layout';
import { drawStartToken, drawFinishSocket } from '../presentation/markers';
import { shadedRect } from '../presentation/material';
import { victoryLayout } from '../presentation/geometry';

export class BoardScene extends Phaser.Scene {
  private theme: Theme = defaultTheme;
  private miniature = false;
  private drawing?: Phaser.GameObjects.Graphics;
  private checkpointLabels: Phaser.GameObjects.Text[] = [];
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
    this.events.once('shutdown', () => { this.scale.off('resize', this.redraw, this); this.sparks = []; this.checkpointLabels = []; });
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
    for (const label of this.checkpointLabels) label.setVisible(false);
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
    const surface = (r: { x: number; y: number; width: number; height: number }, alpha: number, radius: number | Phaser.Types.GameObjects.Graphics.RoundedRectRadius = 0): void => {
      const tone = (y: number) => tint(this.theme.ribbon, .17 - Math.max(0, Math.min(1, (y - layout.y) / Math.max(1, layout.height))) * .29);
      shadedRect(g, r, radius, tone, alpha);
    };
    for (const [index, cell] of this.level.cells.entries()) {
      const t = Math.max(0, Math.min(1, (age - index * 7) / 220));
      const r = scaleRect(rect(cell), 1 - (1 - t) ** 3);
      const radius = Math.min(4, r.width * .075), rim = Math.max(.6, layout.cell * .022);
      // A recessed pocket: darker inner top edge, soft light on the lower lip.
      g.fillStyle(tint(this.theme.empty, -.18), .48); g.fillRoundedRect(r.x, r.y, r.width, r.height, radius);
      const inner = { x: r.x + rim, y: r.y + rim * 1.6, width: Math.max(0, r.width - rim * 2), height: Math.max(0, r.height - rim * 2) };
      shadedRect(g, inner, Math.max(0, radius - rim), y => tint(this.theme.empty, -.05 + Math.max(0, Math.min(1, (y - inner.y) / Math.max(1, inner.height))) * .14));
      g.lineStyle(.9, 0xffffff, .42); g.lineBetween(r.x + radius, r.y + r.height + .5, r.x + r.width - radius, r.y + r.height + .5);
    }
    const depth = this.miniature ? 1.2 : Math.min(3.5, layout.cell * .06);
    const ribbon = (path: readonly number[], alpha: number, shadow = false): void => {
      const connected = (i: number, delta: number) => path[i - 1] === path[i]! + delta || path[i + 1] === path[i]! + delta;
      const fill = (r: { x: number; y: number; width: number; height: number }, radius: number | Phaser.Types.GameObjects.Graphics.RoundedRectRadius = 0) => {
        if (shadow) { g.fillStyle(tint(this.theme.ribbon, -.35), alpha); g.fillRoundedRect(r.x, r.y + depth, r.width, r.height, radius); }
        else surface(r, alpha, radius);
      };
      for (let i = 0; i < path.length; i++) {
        const cell = path[i]!;
        let r = rect(cell);
        if (this.opening) r = scaleRect(r, Math.max(0, Math.min(1, (age - 150) / 170)));
        if (this.pulse?.cell === cell && !this.reduced) r = scaleRect(r, 1 + .045 * Math.sin(Math.min(1, (now - this.pulse.at) / 160) * Math.PI));
        const inset = path === this.route && path.length === 1 ? r.width * .08 : 0;
        r = { x: r.x + inset, y: r.y + inset, width: r.width - inset * 2, height: r.height - inset * 2 };
        const n = connected(i, -this.level.width), e = connected(i, 1), so = connected(i, this.level.width), w = connected(i, -1);
        const radius = Math.min(4, r.width * .075);
        // Round exposed corners only. Connected sides remain flush with their bridge.
        fill(r, { tl: !n && !w ? radius : 0, tr: !n && !e ? radius : 0, bl: !so && !w ? radius : 0, br: !so && !e ? radius : 0 });
      }
      for (let i = 1; i < path.length; i++) {
        const a = rect(path[i - 1]!), b = rect(path[i]!);
        if (a.x === b.x) fill({ x: a.x, y: Math.min(a.y, b.y) + a.height, width: a.width, height: Math.max(0, Math.abs(a.y - b.y) - a.height) });
        else fill({ x: Math.min(a.x, b.x) + a.width, y: a.y, width: Math.max(0, Math.abs(a.x - b.x) - a.width), height: a.height });
      }
      if (shadow || alpha < 1) return;
      // Bevel follows actual path edges, never adjacency to an unconnected filled cell.
      const line = (x: number, y: number, xx: number, yy: number, light: boolean) => {
        g.lineStyle(Math.max(.65, layout.cell * .022), light ? 0xffffff : tint(this.theme.ribbon, -.4), light ? .26 : .22); g.lineBetween(x, y, xx, yy);
      };
      if (this.opening && age < 320) return;
      for (let i = 0; i < path.length; i++) {
        let r = rect(path[i]!);
        if (path.length === 1) r = scaleRect(r, .84);
        const edge = Math.min(4, r.width * .075) + 1;
        const n = connected(i, -this.level.width), e = connected(i, 1), so = connected(i, this.level.width), w = connected(i, -1);
        if (!n) line(r.x + (w ? 0 : edge), r.y + 1, r.x + r.width - (e ? 0 : edge), r.y + 1, true);
        if (!w) line(r.x + 1, r.y + (n ? 0 : edge), r.x + 1, r.y + r.height - (so ? 0 : edge), true);
        if (!so) line(r.x + (w ? 0 : edge), r.y + r.height - 1, r.x + r.width - (e ? 0 : edge), r.y + r.height - 1, false);
        if (!e) line(r.x + r.width - 1, r.y + (n ? 0 : edge), r.x + r.width - 1, r.y + r.height - (so ? 0 : edge), false);
      }
      for (let i = 1; i < path.length; i++) {
        const a = rect(path[i - 1]!), b = rect(path[i]!);
        if (a.x !== b.x) { const x = Math.min(a.x, b.x) + a.width, end = Math.max(a.x, b.x); line(x, a.y + 1, end, a.y + 1, true); line(x, a.y + a.height - 1, end, a.y + a.height - 1, false); }
        else { const y = Math.min(a.y, b.y) + a.height, end = Math.max(a.y, b.y); line(a.x + 1, y, a.x + 1, end, true); line(a.x + a.width - 1, y, a.x + a.width - 1, end, false); }
      }
    };
    if (this.hint.length) ribbon(this.hint, .25);
    ribbon(this.route, .78, true);
    ribbon(this.route, 1);
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
    if (!this.opening || age > 170) {
      if (!this.level.checkpoints?.includes(this.level.start)) {
        const start = rect(this.level.start);
        drawStartToken(g, start.x + start.width / 2, start.y + start.height / 2, layout.cell, this.theme);
      }
      if (!this.miniature && this.route.length > 1 && !this.level.checkpoints?.includes(this.route[this.route.length - 1]!)) {
        const head = rect(this.route[this.route.length - 1]!);
        const hx = head.x + head.width / 2, hy = head.y + head.height / 2, radius = layout.cell * .155;
        g.fillStyle(tint(this.theme.ribbon, -.45), .26); g.fillCircle(hx, hy + 2, radius * 1.15);
        g.lineStyle(1, colorNumber(this.theme.trail), .32); g.strokeCircle(hx, hy, radius * 1.45);
        g.fillStyle(colorNumber(this.theme.trail), .97); g.fillCircle(hx, hy, radius);
        g.fillStyle(colorNumber(this.theme.ribbon)); g.fillCircle(hx, hy, radius * .4);
      }
    }
    // Rules are drawn over the ribbon so they stay legible during hints and undo.
    if (!this.opening || age > 240) {
      for (const [a, b] of this.level.walls ?? []) {
        const aa = rect(a), bb = rect(b), x = (aa.x + bb.x + aa.width) / 2, y = (aa.y + bb.y + aa.height) / 2;
        const thickness = Math.max(2, layout.gap * .62), length = layout.cell * .88;
        const r = aa.y === bb.y ? { x: x - thickness / 2, y: y - length / 2, width: thickness, height: length }
          : { x: x - length / 2, y: y - thickness / 2, width: length, height: thickness };
        g.fillStyle(colorNumber(this.theme.ink), .93); g.fillRoundedRect(r.x, r.y, r.width, r.height, thickness / 2);
        g.lineStyle(Math.max(.5, thickness * .2), colorNumber(this.theme.panel), .45);
        g.lineBetween(r.x + thickness * .2, r.y + thickness * .2, r.x + r.width - thickness * .2, r.y + r.height - thickness * .2);
      }
      if (this.level.finish !== undefined) {
        const r = rect(this.level.finish);
        drawFinishSocket(g, r.x + r.width / 2, r.y + r.height / 2, r.width, this.theme, this.route.includes(this.level.finish));
      }
      const next = this.level.checkpoints?.find(c => !this.route.includes(c));
      for (const [i, cell] of (this.level.checkpoints ?? []).entries()) {
        const r = rect(cell), x = r.x + r.width / 2, y = r.y + r.height / 2, visited = this.route.includes(cell);
        const current = cell === this.route[this.route.length - 1], radius = r.width * .24;
        g.fillStyle(0x35233f, .16); g.fillCircle(x, y + r.width * .035, radius * 1.08);
        if (cell === next || current) {
          g.lineStyle(Math.max(1, r.width * .045), cell === next ? 0xe7a52e : colorNumber(this.theme.trail), .95);
          g.strokeCircle(x, y, radius * 1.3);
        }
        g.fillStyle(visited ? colorNumber(this.theme.ribbon) : 0xfffcf3); g.fillCircle(x, y, radius);
        g.lineStyle(Math.max(.8, r.width * .025), visited ? 0xfffcf3 : 0x64516e, visited ? .9 : .45); g.strokeCircle(x, y, radius);
        if (!this.miniature) {
          const label = this.checkpointLabels[i] ?? (this.checkpointLabels[i] = this.add.text(0, 0, '', { fontFamily: 'Nunito, sans-serif', fontStyle: '900' }).setOrigin(.5).setResolution(2));
          label.setText(String(i + 1)).setFontSize(Math.round(r.width * .34)).setColor(visited ? '#ffffff' : '#362447')
            .setPosition(x * this.renderRatio, y * this.renderRatio).setScale(this.renderRatio).setVisible(true);
        }
      }
    }
  }
}
