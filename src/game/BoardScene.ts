import Phaser from 'phaser';
import { defaultTheme, colorNumber, tint, type Theme } from '../content/themes';
import { levels } from '../content/levels';
import type { Level } from '../core/model';
import { layoutReader, cellRect, type BoardLayout } from '../ui/layout';
import { drawStartToken, drawFinishSocket } from '../presentation/markers';
import { shadedRect } from '../presentation/material';
import { victoryLayout } from '../presentation/geometry';

export class BoardScene extends Phaser.Scene {
  private readLayout = layoutReader();
  private theme: Theme = defaultTheme;
  private miniature = false;
  private drawing?: Phaser.GameObjects.Graphics;
  private routeDrawing?: Phaser.GameObjects.Graphics;
  private baseImage?: Phaser.GameObjects.RenderTexture;
  private routeImage?: Phaser.GameObjects.RenderTexture;
  private pulseDrawing?: Phaser.GameObjects.Graphics;
  private effectDrawing?: Phaser.GameObjects.Graphics;
  private imageFrames = new WeakMap<Phaser.GameObjects.RenderTexture, { x: number; y: number; scale: number }>();
  private baseStamp?: { level: Level; theme: Theme; ratio: number; layout: BoardLayout };
  private currentLayout?: BoardLayout;
  private fxDirty = true;
  private wake?: () => void;
  private sparkPool: { cell: number; at: number; dx: number; dy: number; speed: number }[] = [];
  private checkpointLabels: Phaser.GameObjects.Text[] = [];
  private renderRatio = 1;
  private level: Level = levels[0]!;
  private route: readonly number[] = [this.level.start];
  private hint: readonly number[] = [];
  private opening = 0;
  private sparks: { cell: number; at: number; dx: number; dy: number; speed: number }[] = [];
  private pulse: { cell: number; at: number } | null = null;
  private winning: { from: BoardLayout; at: number } | null = null;
  private dirty = true;
  private rejection: { cell: number; at: number } | null = null;
  private resumeUntil = 0;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor() { super('Board'); }
  create(): void {
    this.drawing = this.make.graphics({});
    this.routeDrawing = this.make.graphics({});
    this.baseImage = this.add.renderTexture(0, 0, 2, 2).setOrigin(0);
    this.pulseDrawing = this.add.graphics();
    this.routeImage = this.add.renderTexture(0, 0, 2, 2).setOrigin(0);
    this.effectDrawing = this.add.graphics();
    this.scale.on('resize', this.redraw, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.redraw, this); this.sparks.length = 0; this.sparkPool.length = 0; this.checkpointLabels = []; this.drawing?.destroy(); this.routeDrawing?.destroy(); this.wake = undefined; });
    this.redraw();
  }
  setState(level: Level, route: readonly number[], hint: readonly number[], miniature: boolean): void {
    if (this.level === level && this.route === route && this.hint === hint && this.miniature === miniature) return;
    if (this.level.id !== level.id) { this.clearSparks(); this.rejection = null; this.resumeUntil = 0; }
    this.level = level; this.route = route; this.hint = hint; this.miniature = miniature; this.redraw();
  }
  open(): void { this.opening = this.reduced ? 0 : performance.now(); this.pulse = null; this.clearSparks(); this.redraw(); }
  react(cell: number, reverse = false): void {
    this.opening = 0; this.resumeUntil = 0; this.rejection = null; this.pulse = this.reduced ? null : { cell, at: performance.now() };
    if (!this.reduced && !reverse) for (let i = 0; i < 6 && this.sparks.length < 36; i++)
      { const angle = i * Math.PI / 3 + Math.random() * .4;
        const spark = this.sparkPool.pop() ?? { cell: 0, at: 0, dx: 0, dy: 0, speed: 0 };
        spark.cell = cell; spark.at = performance.now(); spark.dx = Math.cos(angle); spark.dy = Math.sin(angle); spark.speed = .45 + Math.random() * .3;
        this.sparks.push(spark); }
    this.invalidateFx();
  }
  win(from: BoardLayout): void { this.opening = 0; this.pulse = null; this.winning = { from, at: performance.now() }; this.redraw(); }
  settle(): void { this.rejection = null; this.resumeUntil = 0; this.opening = 0; this.pulse = null; this.winning = null; this.clearSparks(); this.redraw(); }
  reject(cell: number): void { this.rejection = { cell, at: performance.now() }; this.invalidateFx(); }
  resumeHead(): void { if (!this.miniature && this.route.length > 1) { this.resumeUntil = performance.now() + 1200; this.invalidateFx(); } }
  setWakeHandler(wake: () => void): void { this.wake = wake; }
  private clearSparks(): void { for (const spark of this.sparks) this.sparkPool.push(spark); this.sparks.length = 0; }
  private invalidateFx(): void { this.fxDirty = true; this.wake?.(); }
  private animating(): boolean { return Boolean(this.opening || this.winning || this.pulse || this.sparks.length || this.rejection || this.resumeUntil); }
  update(): void {
    const now = performance.now(), boardWasAnimating = Boolean(this.opening), fxWasAnimating = this.animating();
    let kept = 0;
    for (const spark of this.sparks) { if (now - spark.at < 380) this.sparks[kept++] = spark; else this.sparkPool.push(spark); }
    this.sparks.length = kept;
    if (this.opening && now - this.opening > 520) this.opening = 0;
    if (this.pulse && now - this.pulse.at > 160) this.pulse = null;
    if (this.rejection && now - this.rejection.at > 360) this.rejection = null;
    if (this.resumeUntil && now > this.resumeUntil) this.resumeUntil = 0;
    if (boardWasAnimating || this.dirty) { this.dirty = false; this.renderBoard(); this.fxDirty = true; }
    if (this.winning) this.animateWin(now);
    if (fxWasAnimating || this.fxDirty) { this.fxDirty = false; this.renderEffects(); }
    // Finish the current paint before sleeping; the next mutation schedules one wake.
    if (!this.animating() && !this.dirty) this.game.events.once('postrender', () => {
      if (!this.animating() && !this.dirty && !this.fxDirty) this.game.loop.sleep();
    });
  }
  setTheme(theme: Theme): void { if (this.theme !== theme) { this.theme = theme; this.redraw(); } }
  setRenderRatio(value: number): void { if (this.renderRatio !== value) { this.renderRatio = value; this.redraw(); } }
  private redraw(): void { this.dirty = true; this.fxDirty = true; this.wake?.(); }
  private renderBoard(): void {
    const base = this.drawing, g = this.routeDrawing;
    if (!base || !g || !this.baseImage || !this.routeImage) return;
    for (const label of this.checkpointLabels) label.setVisible(false);
    g.clear(); g.setScale(this.renderRatio);
    let layout = this.readLayout(this.scale.width / this.renderRatio, this.scale.height / this.renderRatio, this.miniature, this.level);
    if (this.winning) {
      layout = this.winning.from;
    }
    this.currentLayout = layout;
    const now = performance.now(), age = this.opening ? now - this.opening : 1000;
    const scaleRect = (r: { x: number; y: number; width: number; height: number }, scale: number) => ({
      x: r.x + r.width * (1 - scale) / 2, y: r.y + r.height * (1 - scale) / 2, width: r.width * scale, height: r.height * scale });
    const rect = (cell: number) => cellRect(this.level, layout, cell);
    const surface = (r: { x: number; y: number; width: number; height: number }, alpha: number, radius: number | Phaser.Types.GameObjects.Graphics.RoundedRectRadius = 0): void => {
      const tone = (y: number) => tint(this.theme.ribbon, .17 - Math.max(0, Math.min(1, (y - layout.y) / Math.max(1, layout.height))) * .29);
      shadedRect(g, r, radius, tone, alpha);
    };
    const stamp = this.baseStamp;
    if (this.opening || !stamp || stamp.level !== this.level || stamp.theme !== this.theme || stamp.ratio !== this.renderRatio ||
      stamp.layout.x !== layout.x || stamp.layout.y !== layout.y || stamp.layout.cell !== layout.cell) {
      base.clear(); base.setScale(this.renderRatio);
    for (const [index, cell] of this.level.cells.entries()) {
      const t = Math.max(0, Math.min(1, (age - index * 7) / 220));
      const r = scaleRect(rect(cell), 1 - (1 - t) ** 3);
      const radius = Math.min(4, r.width * .075), rim = Math.max(.6, layout.cell * .022);
      // A recessed pocket: darker inner top edge, soft light on the lower lip.
      base.fillStyle(tint(this.theme.empty, -.18), .48); base.fillRoundedRect(r.x, r.y, r.width, r.height, radius);
      const inner = { x: r.x + rim, y: r.y + rim * 1.6, width: Math.max(0, r.width - rim * 2), height: Math.max(0, r.height - rim * 2) };
      shadedRect(base, inner, Math.max(0, radius - rim), y => tint(this.theme.empty, -.05 + Math.max(0, Math.min(1, (y - inner.y) / Math.max(1, inner.height))) * .14));
      base.lineStyle(.9, 0xffffff, .42); base.lineBetween(r.x + radius, r.y + r.height + .5, r.x + r.width - radius, r.y + r.height + .5);
    }
      this.bake(this.baseImage, base, layout);
      this.baseStamp = this.opening ? undefined : { level: this.level, theme: this.theme, ratio: this.renderRatio, layout };
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
          const label = this.checkpointLabels[i] ?? (this.checkpointLabels[i] = this.add.text(0, 0, '', { fontFamily: 'Road Nunito, sans-serif', fontStyle: '900' }).setOrigin(.5).setResolution(2));
          const size = Math.round(r.width * .34), color = visited ? '#ffffff' : '#362447';
          if (label.text !== String(i + 1)) label.setText(String(i + 1));
          if (label.style.fontSize !== `${size}px`) label.setFontSize(size);
          if (label.style.color !== color) label.setColor(color);
          label.setPosition(x * this.renderRatio, y * this.renderRatio).setScale(this.renderRatio).setVisible(true);
        }
      }
    }
    this.bake(this.routeImage, g, layout);
  }
  private bake(image: Phaser.GameObjects.RenderTexture, drawing: Phaser.GameObjects.Graphics, layout: BoardLayout): void {
    const ratio = this.renderRatio;
    // Supersample the thin route/marker edges, bounded to 1.5M pixels for this one texture.
    const quality = image === this.routeImage ? Math.max(1, Math.min(1.5, Math.sqrt(1_500_000 / ((layout.width + 14) * (layout.height + 14) * ratio * ratio)))) : 1;
    const resolution = ratio * quality, x = Math.floor((layout.x - 7) * resolution), y = Math.floor((layout.y - 7) * resolution);
    const width = Math.ceil((layout.x + layout.width + 7) * resolution) - x, height = Math.ceil((layout.y + layout.height + 7) * resolution) - y;
    image.resize(width, height, false).setPosition(x / quality, y / quality).setScale(1 / quality);
    drawing.setScale(resolution).setPosition(-x, -y);
    image.clear().draw(drawing).render();
    this.imageFrames.set(image, { x: x / resolution, y: y / resolution, scale: 1 / quality });
  }
  private animateWin(now: number): void {
    if (!this.winning) return;
    const target = this.readLayout(this.scale.width / this.renderRatio, this.scale.height / this.renderRatio, true, this.level);
    const layout = victoryLayout(this.winning.from, { ...target, y: target.y + this.scale.height / this.renderRatio * .01 }, this.reduced ? 650 : now - this.winning.at);
    const factor = layout.cell / this.winning.from.cell;
    for (const image of [this.baseImage, this.routeImage]) if (image) {
      const basis = this.imageFrames.get(image); if (!basis) continue;
      image.setPosition((layout.x + (basis.x - this.winning.from.x) * factor) * this.renderRatio,
        (layout.y + (basis.y - this.winning.from.y) * factor) * this.renderRatio).setScale(basis.scale * factor);
    }
  }
  private renderEffects(): void {
    const g = this.effectDrawing, back = this.pulseDrawing, layout = this.currentLayout;
    if (!g || !back || !layout) return;
    g.clear(); back.clear(); g.setScale(this.renderRatio); back.setScale(this.renderRatio);
    if (this.miniature) return;
    const now = performance.now(), rect = (cell: number) => cellRect(this.level, layout, cell);
    if (this.pulse && !this.reduced) {
      const r = rect(this.pulse.cell), t = Math.min(1, (now - this.pulse.at) / 160), scale = 1 + .045 * Math.sin(t * Math.PI);
      const inset = this.route.length === 1 ? r.width * .08 : 0;
      const w = (r.width - inset * 2) * scale, h = (r.height - inset * 2) * scale;
      const expanded = { x: r.x + (r.width - w) / 2, y: r.y + (r.height - h) / 2, width: w, height: h };
      const previous = this.route[this.route.length - 2], head = this.pulse.cell, radius = Math.min(4, w * .075);
      const corners = { tl: previous !== head - this.level.width && previous !== head - 1 ? radius : 0,
        tr: previous !== head - this.level.width && previous !== head + 1 ? radius : 0,
        bl: previous !== head + this.level.width && previous !== head - 1 ? radius : 0,
        br: previous !== head + this.level.width && previous !== head + 1 ? radius : 0 };
      back.fillStyle(tint(this.theme.ribbon, -.35), .78); back.fillRoundedRect(expanded.x, expanded.y + Math.min(3.5, layout.cell * .06), w, h, corners);
      shadedRect(back, expanded, corners, y => tint(this.theme.ribbon, .17 - Math.max(0, Math.min(1, (y - layout.y) / Math.max(1, layout.height))) * .29));
      g.lineStyle(2 * (1 - t), colorNumber(this.theme.trail), (1 - t) * .65);
      g.strokeCircle(r.x + r.width / 2, r.y + r.height / 2, r.width * (.19 + t * .26));
    }
    for (const spark of this.sparks) {
      const t = Math.min(1, (now - spark.at) / 380), r = rect(spark.cell), distance = r.width * (.30 + t * spark.speed);
      g.fillStyle(colorNumber(this.theme.ribbon), (1 - t) * .8);
      g.fillCircle(r.x + r.width / 2 + spark.dx * distance, r.y + r.height / 2 + spark.dy * distance - t * r.height * .2, (1 - t) * 2.4 + .5);
    }
    if (this.resumeUntil) {
      const r = rect(this.route[this.route.length - 1]!), t = (1200 - this.resumeUntil + now) / 1200;
      g.lineStyle(2, colorNumber(this.theme.trail), .55 * (1 - t));
      g.strokeCircle(r.x + r.width / 2, r.y + r.height / 2, r.width * (.3 + .13 * (this.reduced ? 0 : t)));
    }
    if (this.rejection) {
      const r = rect(this.rejection.cell), t = Math.min(1, (now - this.rejection.at) / 360);
      g.lineStyle(Math.max(2, r.width * .045), 0xe08045, 1 - t * .7);
      g.strokeRoundedRect(r.x - 2, r.y - 2, r.width + 4, r.height + 4, 5);
    }
  }
}
