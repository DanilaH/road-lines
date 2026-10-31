import { createValueTransferPlan, valueAfterVisualArrival, valueTransferEmissionDelay, shouldPlayValueTransferCue } from '../../vendor/mini-games-kit/src/core/value-transfer';
import type { Feedback } from './feedback';

interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; angle: number; spin: number; size: number; kind: number; color: string; }
const starPoints = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? .4 : 1, a = i * Math.PI / 5; return { x: Math.cos(a) * r, y: Math.sin(a) * r }; });
const ribbonPoints = Array.from({ length: 11 }, (_, i) => ({ sin: Math.sin(i * .8), cos: Math.cos(i * .8), y: -.5 + i / 10 }));
const colors = ['#a855ed', '#ffcc24', '#24ccd4', '#f75da3', '#9bdc36', '#ff8e48'];
export class WinMotion {
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private animations = new Set<Animation>();
  private coins: HTMLElement[] = [];
  private canvas: HTMLCanvasElement;
  private particles: Particle[] = [];
  private pool: Particle[] = [];
  private ctx: CanvasRenderingContext2D | null;
  private starPath?: Path2D;
  private drawFrame = (now: number): void => this.draw(now);
  private raf = 0;
  private lastFrame = 0;
  private finishCollect?: (ok: boolean) => void;
  private balance = 0;
  private reward = 0;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(private root: HTMLElement, private feedback: Feedback, private displayBalance: (value: number) => void) {
    this.canvas = document.createElement('canvas'); this.canvas.className = 'celebration-layer'; this.canvas.setAttribute('aria-hidden', 'true'); root.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    if (typeof Path2D !== 'undefined') { this.starPath = new Path2D(); for (const p of starPoints) this.starPath.lineTo(p.x, p.y); this.starPath.closePath(); }
  }
  private after(ms: number, fn: () => void): void { const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, ms); this.timers.add(timer); }
  private animate(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): void {
    try {
      const a = el.animate(keyframes, options); this.animations.add(a);
      a.finished.then(() => this.animations.delete(a), () => this.animations.delete(a));
    } catch {
      // Reduced-capability WebViews still get a usable settled result.
      const style = (el as HTMLElement | SVGElement).style, last = keyframes[keyframes.length - 1]!;
      for (const [key, value] of Object.entries(last)) if (!['offset', 'easing', 'composite'].includes(key) && value !== undefined)
        style.setProperty(key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), String(value));
    }
  }
  private query(selector: string): HTMLElement { return this.root.querySelector<HTMLElement>(selector)!; }
  start(reward: number, balance: number, giftCount: number, settleBoard: () => void): void {
    this.stop(); this.balance = balance; this.reward = reward; this.displayBalance(balance - reward);
    this.root.dataset.winPhase = 'building';
    const next = this.query('.next') as HTMLButtonElement; next.disabled = true;
    const title = this.query('.result-heading h1'); title.replaceChildren(...[...'ГОТОВО!'].map((letter, i) => {
      const span = document.createElement('span'); span.textContent = letter; span.style.setProperty('--letter', String(i)); return span;
    }));
    const letters = [...title.children];
    letters.forEach((el, i) => this.animate(el, [
      { opacity: 0, transform: 'translateY(22px) scale(.4) rotate(-12deg)' },
      { opacity: 1, transform: 'translateY(-5px) scale(1.12) rotate(3deg)', offset: .75 },
      { opacity: 1, transform: 'translateY(0) scale(1) rotate(0deg)' },
    ], { duration: this.reduced ? 80 : 340, delay: this.reduced ? 0 : 220 + i * 38, fill: 'backwards', easing: 'cubic-bezier(.2,.8,.2,1)' }));
    this.root.querySelectorAll('.star').forEach((el, i) => {
      this.animate(el, [{ opacity: 0, transform: 'translateY(30px) rotate(-35deg) scale(0)' },
        { opacity: 1, transform: 'translateY(-7px) rotate(8deg) scale(1.22)', offset: .72 },
        { opacity: 1, transform: 'translateY(0) rotate(0) scale(1)' }],
      { duration: this.reduced ? 80 : 380, delay: this.reduced ? 50 : 350 + i * 150, fill: 'backwards', easing: 'cubic-bezier(.2,.8,.25,1)' });
      this.after(this.reduced ? 50 + i * 50 : 350 + i * 150, () => this.feedback.play('star', i / 2));
    });
    this.animate(this.query('.rewards'), [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 220, delay: this.reduced ? 50 : 350, fill: 'backwards', easing: 'ease-out' });
    const meter = (n: number) => n === 0 ? 0 : (n - 1) % 20 + 1;
    const fraction = meter(Math.max(0, giftCount - (reward > 0 ? 1 : 0))) / 20;
    this.animate(this.query('.track span'), [{ width: `${fraction * 100}%` }, { width: `${meter(giftCount) * 5}%` }], { duration: 600, delay: 650, fill: 'backwards', easing: 'ease-out' });
    this.feedback.play('win');
    this.after(this.reduced ? 80 : 400, () => { next.disabled = false; });
    this.after(this.reduced ? 80 : 650, () => { this.root.dataset.winPhase = 'idle'; settleBoard(); });
    this.after(this.reduced ? 100 : 720, () => this.burst(115, 0));
    this.after(this.reduced ? 180 : 1040, () => this.burst(100, -1));
    this.after(this.reduced ? 260 : 1370, () => this.burst(115, 1));
    this.after(850, () => { if (this.reward) this.scatter(); });
    if (reward) this.after(1050, () => { this.feedback.play('progress'); this.animate(this.query('.gift-progress .reward-art'), [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-15deg) scale(1.25)' }, { transform: 'rotate(12deg) scale(1.1)' }, { transform: 'rotate(0) scale(1)' }], { duration: 440 }); });
  }
  private origin(): { x: number; y: number } {
    const r = this.query('#board').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }
  private scatter(): void {
    if (this.coins.length || !this.reward) return;
    const origin = this.origin();
    const plan = createValueTransferPlan(this.reward, { minDurationMs: 470, maxDurationMs: 560, maxVisualTokens: 16, maxAudioEvents: 7 });
    for (let i = 0; i < plan.visualTokenCount; i++) {
      const node = document.createElement('span'); node.className = 'coin flying-coin'; node.textContent = '•'; node.setAttribute('aria-hidden', 'true');
      const angle = i * 2.39996, radius = 15 + Math.sqrt(i / plan.visualTokenCount) * 70;
      const x = origin.x + Math.cos(angle) * radius, y = origin.y + Math.sin(angle) * radius * .65;
      node.style.transform = `translate(${x - 12}px, ${y - 12}px)`; this.root.append(node); this.coins.push(node);
      this.animate(node, [{ transform: `translate(${origin.x - 12}px, ${origin.y - 12}px) scale(0)` },
        { transform: `translate(${x - 12}px, ${y - 12}px) scale(1.15) rotate(${i * 35}deg)`, offset: .75 },
        { transform: `translate(${x - 12}px, ${y - 12}px) scale(1) rotate(${i * 35}deg)` }], { duration: this.reduced ? 60 : 360, delay: i * 12, fill: 'backwards', easing: 'ease-out' });
    }
  }
  collect(): Promise<boolean> {
    if (this.finishCollect) return Promise.resolve(false);
    if (!this.reward) return Promise.resolve(true);
    this.scatter();
    const target = this.query('.wallet').getBoundingClientRect();
    const plan = createValueTransferPlan(this.reward, { minDurationMs: 280, maxDurationMs: 360, maxVisualTokens: 16, maxAudioEvents: 7, flightBaseMs: 180, maxFlightDurationMs: 240 });
    return new Promise(resolve => {
      this.finishCollect = resolve;
      this.coins.forEach((node, i) => {
        const rect = node.getBoundingClientRect(), sx = rect.x, sy = rect.y;
        node.getAnimations().forEach(a => a.cancel());
        const dx = target.x + target.width * .25 - 12, dy = target.y + target.height / 2 - 12;
        const duration = this.reduced ? 90 : plan.flightDurationMs, delay = this.reduced ? 0 : valueTransferEmissionDelay(plan, i);
        this.animate(node, [{ opacity: 1, transform: `translate(${sx}px, ${sy}px) scale(1)` },
          { opacity: 1, transform: `translate(${sx + (dx - sx) * .28 - 25}px, ${sy + (dy - sy) * .58}px) scale(1.15)`, offset: .5 },
          { opacity: 0.2, transform: `translate(${dx}px, ${dy}px) scale(.45)` }], { duration, delay, fill: 'forwards', easing: 'cubic-bezier(.3,.05,.7,.4)' });
        this.after(duration + delay, () => {
          this.displayBalance(this.balance - this.reward + valueAfterVisualArrival(plan, i));
          if (shouldPlayValueTransferCue(plan, i)) this.feedback.play('coin', (i + 1) / plan.visualTokenCount);
          this.animate(this.query('.wallet'), [{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 140 }); node.remove();
        });
      });
      this.after(this.reduced ? 110 : plan.durationMs + 25, () => { this.displayBalance(this.balance); this.reward = 0; this.finishCollect = undefined; resolve(true); });
    });
  }
  private burst(count: number, side: number): void {
    const origin = this.origin(), width = innerWidth;
    const actualCount = this.reduced ? 18 : count;
    for (let i = 0; i < actualCount && this.particles.length < 360; i++) {
      const angle = -Math.PI / 2 + (Math.random() - .5) * 2.9, speed = (260 + Math.random() * 400) * (this.reduced ? .4 : 1);
      const p = this.pool.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, angle: 0, spin: 0, size: 0, kind: 0, color: '' };
      p.x = origin.x + side * Math.min(width * .22, 125); p.y = origin.y + (side < 0 ? -innerHeight * .24 : side > 0 ? innerHeight * .22 : 0);
      p.vx = Math.cos(angle) * speed + side * 70; p.vy = Math.sin(angle) * speed; p.age = 0; p.life = 2.7 + Math.random() * 1.3;
      p.angle = Math.random() * 6; p.spin = (Math.random() - .5) * 12; p.size = 4 + Math.random() * 6;
      p.kind = i % 12 === 11 ? 3 : i % 3; p.color = colors[(i + Math.floor(i / 12)) % colors.length]!; this.particles.push(p);
    }
    if (!this.raf) { this.lastFrame = performance.now(); this.raf = requestAnimationFrame(this.drawFrame); }
  }
  private draw(now: number): void {
    this.raf = 0;
    const ratio = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
    if (this.canvas.width !== Math.round(w * ratio) || this.canvas.height !== Math.round(h * ratio)) {
      this.canvas.width = Math.round(w * ratio); this.canvas.height = Math.round(h * ratio);
    }
    const ctx = this.ctx; if (!ctx) { this.releaseParticles(); return; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h);
    const dt = Math.min(.035, Math.max(0, (now - this.lastFrame) / 1000)); this.lastFrame = now;
    let kept = 0;
    for (const p of this.particles) { if (p.age < p.life && p.y < h + 90) this.particles[kept++] = p; else this.pool.push(p); }
    this.particles.length = kept;
    for (const p of this.particles) {
      p.age += dt; p.vx *= 1 - dt * .35; p.vy += dt * 420; p.x += p.vx * dt; p.y += p.vy * dt; p.angle += p.spin * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, Math.max(0, (p.life - p.age) * 2));
      if (p.kind === 0) ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .65);
      else if (p.kind === 1) { ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size, p.size); ctx.lineTo(-p.size, p.size); ctx.fill(); }
      else if (p.kind === 2) {
        if (this.starPath) { ctx.scale(p.size, p.size); ctx.fill(this.starPath); }
        else { ctx.beginPath(); for (const point of starPoints) ctx.lineTo(point.x * p.size, point.y * p.size); ctx.closePath(); ctx.fill(); }
      }
      else {
        const length = p.size * 14;
        ctx.scale(Math.cos(p.age * 8) * .5 + .7, 1); ctx.beginPath();
        const sin = Math.sin(p.age * 9), cos = Math.cos(p.age * 9);
        for (let j = 0; j <= 10; j++) {
          const point = ribbonPoints[j]!, x = (point.sin * cos + point.cos * sin) * p.size * .75, y = length * point.y;
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.restore();
    }
    if (this.particles.length) this.raf = requestAnimationFrame(this.drawFrame);
  }
  private releaseParticles(): void { for (const p of this.particles) this.pool.push(p); this.particles.length = 0; }
  stop(): void {
    this.timers.forEach(clearTimeout); this.timers.clear(); this.animations.forEach(a => a.cancel()); this.animations.clear();
    this.coins.forEach(c => c.remove()); this.coins = []; this.releaseParticles(); cancelAnimationFrame(this.raf); this.raf = 0;
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.displayBalance(this.balance); this.reward = 0; this.finishCollect?.(false); this.finishCollect = undefined;
    this.root.dataset.winPhase = 'idle';
    const next = this.root.querySelector<HTMLButtonElement>('.next'); if (next) next.disabled = false;
  }
  dispose(): void { this.stop(); this.pool.length = 0; this.canvas.remove(); }
}
