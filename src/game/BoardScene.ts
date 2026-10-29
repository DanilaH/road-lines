import Phaser from 'phaser';
import { presentation, sampleCells, sampleRoute } from '../config/presentation';
import { boardLayout } from '../ui/layout';

export class BoardScene extends Phaser.Scene {
  private miniature = false;
  private drawing?: Phaser.GameObjects.Graphics;
  private renderRatio = 1;

  constructor() { super('Board'); }

  create(): void {
    this.drawing = this.add.graphics();
    this.scale.on('resize', this.redraw, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.redraw, this));
    this.redraw();
  }

  setMiniature(value: boolean): void { this.miniature = value; this.redraw(); }
  setRenderRatio(value: number): void { this.renderRatio = value; this.redraw(); }

  private redraw(): void {
    const g = this.drawing;
    if (!g) return;
    g.clear();
    g.setScale(this.renderRatio);
    const { x, y, cell, gap } = boardLayout(this.scale.width / this.renderRatio, this.scale.height / this.renderRatio, this.miniature);
    const step = cell + gap;
    const route = this.miniature ? sampleRoute : sampleRoute.slice(0, 1);
    const visited = new Set(route.map(([cx, cy]) => `${cx},${cy}`));
    for (const [cx, cy] of sampleCells) {
      const filled = visited.has(`${cx},${cy}`);
      g.fillStyle(presentation.empty);
      g.fillRect(x + cx * step, y + cy * step, cell, cell);
      if (!filled) continue;
      g.fillStyle(presentation.fill);
      const inset = filled && !this.miniature ? cell * 0.08 : 0;
      g.fillRect(x + cx * step + inset, y + cy * step + inset, cell - 2 * inset, cell - 2 * inset);
    }
    for (let i = 1; i < route.length; i++) {
      const [ax, ay] = route[i - 1]!;
      const [bx, by] = route[i]!;
      g.fillStyle(presentation.fill);
      if (ax === bx) g.fillRect(x + ax * step, y + Math.min(ay, by) * step, cell, step + cell);
      else g.fillRect(x + Math.min(ax, bx) * step, y + ay * step, step + cell, cell);
    }
    if (this.miniature) {
      g.fillStyle(0xffffff, 0.7);
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1]!, b = route[i]!;
        const length = step;
        for (let d = 0; d < length; d += 5) {
          const t = d / length;
          g.fillCircle(x + (a[0] + (b[0] - a[0]) * t) * step + cell / 2,
            y + (a[1] + (b[1] - a[1]) * t) * step + cell / 2, 0.8);
        }
      }
    } else {
      // Own start glyph, stays attached to the initial cell.
      g.lineStyle(2.6, 0xffffff, 0.95);
      const cx = x + cell / 2, cy = y + cell / 2;
      g.beginPath(); g.arc(cx, cy, cell * 0.18, 0.4, 5.3); g.strokePath();
      g.fillStyle(0xffffff); g.fillTriangle(cx + cell * 0.15, cy - cell * 0.18,
        cx + cell * 0.15, cy - cell * 0.02, cx + cell * 0.28, cy - cell * 0.13);
    }
  }
}
