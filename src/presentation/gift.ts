import { copy } from '../i18n';
import { coin } from '../ui/icons';
import type { Feedback } from './feedback';

const box = `<svg class="gift-box" viewBox="0 0 240 250" aria-hidden="true"><defs>
<linearGradient id="gift-violet" x2="1" y2="1"><stop stop-color="#ba81ff"/><stop offset=".5" stop-color="#8a4edc"/><stop offset="1" stop-color="#6034a2"/></linearGradient>
<linearGradient id="gift-gold" x2=".3" y2="1"><stop stop-color="#fff0af"/><stop offset=".45" stop-color="#ffd35d"/><stop offset="1" stop-color="#d99625"/></linearGradient></defs>
<ellipse cx="120" cy="227" rx="76" ry="12" fill="#633282" opacity=".12"/>
<g class="gift-base"><path d="M48 109L120 143L192 109V182L120 219L48 182Z" fill="url(#gift-violet)" stroke="#7137b1" stroke-width="2"/>
<path d="M120 143V219L192 182V109Z" fill="#6130a0" opacity=".36"/><path d="M78 123L96 132V207L78 198Z M148 130L166 121V196L148 205Z" fill="url(#gift-gold)"/>
<path d="M52 115L117 146V213" stroke="#efceff" stroke-width="2" opacity=".5" fill="none"/></g>
<g class="gift-lid"><path d="M39 99L120 59L201 99V116L120 156L39 116Z" fill="url(#gift-violet)" stroke="#7137b1" stroke-width="2"/>
<path d="M39 99L120 59L201 99L120 139Z" fill="#b276ef"/><path d="M120 139L201 99V116L120 156Z" fill="#713aab"/>
<path d="M73 82L91 73L171 113L153 122Z M72 115L153 75L171 84L91 124V141L72 132Z" fill="url(#gift-gold)"/>
<path d="M120 73C71 70 76 29 99 41C111 47 119 66 120 73Z M120 73C169 70 164 29 141 41C129 47 121 66 120 73Z" fill="url(#gift-gold)" stroke="#e5a732" stroke-width="3"/>
<ellipse cx="120" cy="70" rx="11" ry="9" fill="#ffdb70" stroke="#d99a28" stroke-width="2"/>
<path d="M44 99L120 136L196 99" fill="none" stroke="#eed1ff" stroke-width="2" opacity=".65"/></g></svg>`;

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
      art.innerHTML = `<div class="gift-wallet">${coin}<span class="gift-balance"></span></div><p class="gift-milestone"></p><div class="gift-stage" aria-hidden="true"><div class="gift-rays"></div>${box}<div class="gift-prize">${coin}<strong>+100</strong></div></div>`;
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
  private animate(node: Element, frames: Keyframe[], duration: number, delay = 0): void {
    try {
      const a = node.animate(frames, { duration, delay, easing: 'cubic-bezier(.18,.75,.25,1)', fill: 'backwards' }); this.animations.add(a);
      const done = () => this.animations.delete(a); a.finished.then(done, done);
    } catch { /* CSS already holds the settled result. */ }
  }
  start(): void {
    this.stop(); this.running = true; this.host.dataset.reveal = 'open';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { this.feedback.play('gift'); this.count(this.balance); this.running = false; return; }
    this.count(Math.max(0, this.balance - 100));
    this.animate(this.host.querySelector('.gift-box')!, [{ transform: 'scale(.5) translateY(35px)', opacity: 0 }, { transform: 'scale(1.06) rotate(-4deg)', opacity: 1, offset: .65 }, { transform: 'scale(1) rotate(0)' }], 360);
    this.animate(this.host.querySelector('.gift-lid')!, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-69px) rotate(-13deg)' }], 460, 320);
    this.animate(this.host.querySelector('.gift-base')!, [{ transform: 'translateY(0)' }, { transform: 'translateY(18px)' }], 350, 360);
    this.animate(this.host.querySelector('.gift-rays')!, [{ transform: 'scale(.1) rotate(-25deg)', opacity: 0 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], 650, 360);
    this.animate(this.host.querySelector('.gift-prize')!, [{ transform: 'translateY(70px) scale(.3)', opacity: 0 }, { transform: 'translateY(-3px) scale(1.12)', opacity: 1, offset: .75 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], 500, 470);
    this.after(320, () => this.feedback.play('gift'));
    this.after(580, () => this.burst());
    this.after(850, () => this.collect());
    this.after(1900, () => this.stop());
  }
  private burst(): void {
    const layer = this.host.querySelector('.gift-particles')!;
    const stage = this.host.querySelector('.gift-stage')!.getBoundingClientRect(), bounds = this.host.getBoundingClientRect();
    for (let i = 0; i < 28; i++) {
      const node = document.createElement('i'), angle = i * 2.39996; layer.append(node);
      node.style.background = ['#ffc937', '#9860ea', '#35bbba', '#f66e95'][i % 4]!;
      node.style.left = `${stage.x + stage.width / 2 - bounds.x}px`; node.style.top = `${stage.y + stage.height * .38 - bounds.y}px`;
      node.style.borderRadius = i % 3 ? '2px' : '50%';
      this.animate(node, [{ transform: 'translate(0,0) scale(0)', opacity: 1 }, { transform: `translate(${Math.cos(angle) * (95 + i * 3)}px,${Math.sin(angle) * (95 + i * 3)}px) rotate(${i * 45}deg)`, opacity: 0 }], 1050);
    }
  }
  private collect(): void {
    const stage = this.host.querySelector('.gift-stage')!.getBoundingClientRect(), wallet = this.host.querySelector('.gift-wallet')!.getBoundingClientRect(), bounds = this.host.getBoundingClientRect();
    const x = stage.x + stage.width / 2 - bounds.x, y = stage.y + stage.height * .38 - bounds.y;
    const targetX = wallet.x + wallet.width / 2 - bounds.x, targetY = wallet.y + wallet.height / 2 - bounds.y;
    const layer = this.host.querySelector('.gift-particles')!;
    for (let i = 0; i < 10; i++) {
      const node = document.createElement('span'); node.className = 'gift-token'; node.innerHTML = coin; layer.append(node);
      const dx = Math.cos(i * 2.39996) * 45, dy = Math.sin(i * 2.39996) * 35;
      // Token positions are relative to the overlay; confetti uses the same origin.
      node.style.left = '0'; node.style.top = '0';
      this.animate(node, [{ transform: `translate(${x}px,${y}px) scale(.3)`, opacity: 0 }, { transform: `translate(${x + dx}px,${y + dy}px) scale(1.15)`, opacity: 1, offset: .25 }, { transform: `translate(${targetX}px,${targetY}px) scale(.5)`, opacity: 0 }], 540, i * 26);
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
