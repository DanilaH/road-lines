import { copy } from '../i18n';
import { coin } from '../ui/icons';
import type { Feedback } from './feedback';
import giftUrl from '../assets/rewards/gift.webp';
import interiorUrl from '../assets/rewards/gift-interior.webp';

// Original lid and front faces are literal clips of the accepted gift asset.
// The missing interior is a reference-derived raster, clipped behind those front faces.
const box = `<svg class="gift-box" viewBox="0 0 384 384" aria-hidden="true"><defs>
<clipPath id="gift-original-lid"><path d="M0 0H384V178H335L331 185L218 220L202 224L187 223L62 187L56 183H0Z"/></clipPath>
<clipPath id="gift-original-front"><path d="M0 193H60L184 231Q200 238 216 232L333 193H384V384H0Z"/></clipPath>
<clipPath id="gift-opening"><path d="M59 193L193 129L333 193L201 235Z"/></clipPath>
<radialGradient id="gift-opening-light"><stop stop-color="#fffbea" stop-opacity=".6"/><stop offset=".6" stop-color="#ffda6d" stop-opacity=".16"/><stop offset="1" stop-color="#ffca3e" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="195" cy="342" rx="112" ry="15" fill="#633282" opacity=".12"/>
<g class="gift-base"><image class="gift-back-wall" href="${interiorUrl}" x="58" y="129" width="276" height="211" preserveAspectRatio="none" clip-path="url(#gift-opening)"/>
<ellipse class="gift-opening-light" cx="195" cy="185" rx="126" ry="62" fill="url(#gift-opening-light)" clip-path="url(#gift-opening)"/>
<image class="gift-original-front" href="${giftUrl}" width="384" height="384" clip-path="url(#gift-original-front)"/></g>
<g class="gift-lid"><image href="${giftUrl}" width="384" height="384" clip-path="url(#gift-original-lid)"/></g></svg>`;

/** Presentation only. The +100 already belongs to the durable first-clear transaction. */
export class GiftReveal {
  private animations = new Set<Animation>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private running = false;
  private balance = 0;
  constructor(private host: HTMLElement, private feedback: Feedback) {}
  render(balance: number, milestone: number): void {
    this.balance = balance;
    const art = this.host.querySelector<HTMLElement>('.bonus-art')!;
    if (!art.querySelector('.gift-stage')) {
      this.host.querySelector('.gift-particles')?.remove();
      art.innerHTML = `<div class="gift-wallet">${coin}<span class="gift-balance"></span></div><p class="gift-milestone"></p><div class="gift-stage" aria-hidden="true"><div class="gift-rays"></div><div class="gift-light-cone"></div><div class="gift-light-halo"></div>${box}<div class="gift-prize">${coin}<strong>+100</strong></div></div>`;
      const particles = document.createElement('div'); particles.className = 'gift-particles'; particles.setAttribute('aria-hidden', 'true'); this.host.append(particles);
    }
    this.host.querySelector('.gift-milestone')!.textContent = copy.giftMilestone(milestone);
    this.host.querySelector('.gift-wallet')!.setAttribute('aria-label', copy.balance(balance));
    if (!this.running) this.count(balance);
  }
  private count(value: number): void { const n = this.host.querySelector('.gift-balance'); if (n) n.textContent = String(value); }
  private after(ms: number, task: () => void): void {
    const timer = setTimeout(() => { this.timers.delete(timer); if (this.running) task(); }, ms); this.timers.add(timer);
  }
  private animate(node: Element, frames: Keyframe[], duration: number, delay = 0, remove = false): void {
    try {
      const a = node.animate(frames, { duration, delay, easing: 'cubic-bezier(.18,.75,.25,1)', fill: 'backwards' }); this.animations.add(a);
      const done = () => { this.animations.delete(a); if (remove) node.remove(); }; a.finished.then(done, done);
    } catch { if (remove) node.remove(); /* CSS already holds the settled result. */ }
  }
  start(): void {
    this.stop(); this.running = true; this.host.dataset.reveal = 'open';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { this.feedback.play('gift'); this.count(this.balance); this.running = false; return; }
    this.count(Math.max(0, this.balance - 100));
    this.animate(this.host.querySelector('.gift-box')!, [{ transform: 'scale(.5) translateY(35px)', opacity: 0 }, { transform: 'scale(1.06) rotate(-4deg)', opacity: 1, offset: .65 }, { transform: 'scale(1) rotate(0)' }], 360);
    this.animate(this.host.querySelector('.gift-lid')!, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(-15px,-65px) rotate(-8deg)', opacity: 1, offset: .6 }, { transform: 'translate(-35px,-112px) rotate(-15deg)', opacity: 0 }], 650, 320);
    this.animate(this.host.querySelector('.gift-base')!, [{ transform: 'translateY(0)' }, { transform: 'translateY(12px)' }], 350, 360);
    this.animate(this.host.querySelector('.gift-rays')!, [{ transform: 'scale(.1) rotate(-25deg)', opacity: 0 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], 650, 360);
    this.animate(this.host.querySelector('.gift-prize')!, [{ transform: 'translateY(70px) scale(.3)', opacity: 0 }, { transform: 'translateY(-3px) scale(1.12)', opacity: 1, offset: .75 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], 500, 470);
    this.animate(this.host.querySelector('.gift-light-cone')!, [{ transform: 'scaleY(.15) scaleX(.5)', opacity: 0 }, { transform: 'scale(1.12)', opacity: .95, offset: .4 }, { transform: 'scale(1)', opacity: .5 }], 1100, 330);
    this.animate(this.host.querySelector('.gift-light-halo')!, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.2)', opacity: .85, offset: .35 }, { transform: 'scale(1)', opacity: .42 }], 1000, 350);
    this.after(320, () => this.feedback.play('gift'));
    this.after(500, () => this.burst(48, 0));
    this.after(740, () => this.burst(40, 1));
    this.after(850, () => this.collect());
    this.after(2500, () => this.stop());
  }
  private origin(): { x: number; y: number } {
    const r = this.host.querySelector('.gift-box')!.getBoundingClientRect(), bounds = this.host.getBoundingClientRect();
    return { x: r.x + r.width * 195 / 384 - bounds.x, y: r.y + r.height * 190 / 384 - bounds.y };
  }
  private burst(count: number, phase: number): void {
    const layer = this.host.querySelector('.gift-particles')!, origin = this.origin();
    for (let i = 0; i < count; i++) {
      const node = document.createElement('i'), angle = -.15 - Math.PI * ((i * .618034 + phase * .19) % 1), distance = 105 + (i * 47 % 120);
      const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance;
      layer.append(node); node.className = i % 6 === 0 ? 'gift-ribbon' : i % 4 === 0 ? 'gift-confetti-round' : '';
      node.style.background = ['#ffc527', '#8a46ea', '#0fb9b1', '#ff528b', '#ff9233', '#ece2ff'][i % 6]!;
      node.style.left = `${origin.x}px`; node.style.top = `${origin.y}px`;
      const rotation = i * 67, fall = 100 + i % 7 * 17;
      this.animate(node, [{ transform: 'translate(0,0) scale(.5)', opacity: 0 },
        { transform: `translate(${x * .22}px,${y * .4}px) rotate(${rotation * .25}deg)`, opacity: 1, offset: .13 },
        { transform: `translate(${x * .82}px,${y}px) rotate(${rotation}deg)`, opacity: 1, offset: .48 },
        { transform: `translate(${x}px,${y + fall}px) rotate(${rotation + 180}deg)`, opacity: .85, offset: .83 },
        { transform: `translate(${x * 1.07}px,${y + fall + 70}px) rotate(${rotation + 260}deg)`, opacity: 0 }], 1250 + i % 5 * 70, 0, true);
    }
  }
  private collect(): void {
    const wallet = this.host.querySelector('.gift-wallet')!.getBoundingClientRect(), bounds = this.host.getBoundingClientRect();
    const { x, y } = this.origin();
    const targetX = wallet.x + wallet.width / 2 - bounds.x, targetY = wallet.y + wallet.height / 2 - bounds.y;
    const layer = this.host.querySelector('.gift-particles')!;
    for (let i = 0; i < 10; i++) {
      const node = document.createElement('span'); node.className = 'gift-token'; node.innerHTML = coin; layer.append(node);
      const dx = Math.cos(i * 2.39996) * 45, dy = Math.sin(i * 2.39996) * 35;
      // Token positions are relative to the overlay; confetti uses the same origin.
      node.style.left = '0'; node.style.top = '0';
      this.animate(node, [{ transform: `translate(${x}px,${y}px) scale(.3)`, opacity: 0 }, { transform: `translate(${x + dx}px,${y + dy}px) scale(1.15)`, opacity: 1, offset: .25 }, { transform: `translate(${targetX}px,${targetY}px) scale(.5)`, opacity: 0 }], 540, i * 26, true);
      this.after(470 + i * 26, () => { this.count(Math.round(this.balance - 100 + (i + 1) * 10)); if (i % 2 === 0) this.feedback.play('coin', i / 10); });
    }
  }
  stop(): void {
    const wasRunning = this.running; this.running = false;
    for (const timer of this.timers) clearTimeout(timer); this.timers.clear();
    for (const a of this.animations) a.cancel(); this.animations.clear();
    this.host.querySelector('.gift-particles')?.replaceChildren(); this.count(this.balance);
    this.host.dataset.reveal = 'open';
    if (wasRunning) this.feedback.cancel();
  }
  dispose(): void { this.stop(); }
}
