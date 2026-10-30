/** Disposable visual transitions. Navigation, input and rewards never await these. */
export class ScreenMotion {
  private animations = new Set<Animation>();
  private ghost?: HTMLElement;
  private onVisibility = () => { if (document.hidden) this.stop(); };
  constructor() { document.addEventListener('visibilitychange', this.onVisibility); }
  private get reduced(): boolean { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  private animate(el: HTMLElement, frames: Keyframe[], duration: number, delay = 0): void {
    if (this.reduced) return;
    try {
      const animation = el.animate(frames, { duration, delay, easing: 'cubic-bezier(.18,.8,.25,1)', fill: 'backwards' });
      this.animations.add(animation);
      animation.finished.then(() => this.animations.delete(animation), () => this.animations.delete(animation));
    } catch { /* Settled DOM is already usable on reduced-capability WebViews. */ }
  }
  private fadeCopy(el: HTMLElement): void {
    if (this.reduced || el.hidden) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.inert = true; ghost.setAttribute('aria-hidden', 'true'); ghost.removeAttribute('role'); ghost.dataset.transitionGhost = '';
    ghost.querySelectorAll('[data-action]').forEach(node => node.removeAttribute('data-action'));
    Object.assign(ghost.style, { position: 'fixed', inset: 'auto', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', pointerEvents: 'none', zIndex: '12' });
    el.parentElement!.append(ghost); this.ghost = ghost;
    try {
      const animation = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
      this.animations.add(animation);
      const cleanup = () => { this.animations.delete(animation); ghost.remove(); if (this.ghost === ghost) this.ghost = undefined; };
      animation.finished.then(cleanup, cleanup);
    } catch { ghost.remove(); this.ghost = undefined; }
  }
  leaveMenu(el: HTMLElement): void { this.stop(); this.fadeCopy(el); }
  enterGame(root: HTMLElement): void {
    this.animate(root.querySelector<HTMLElement>('#board')!, [{ opacity: 0 }, { opacity: 1 }], 240);
    this.animate(root.querySelector<HTMLElement>('.hud')!, [{ opacity: 0, transform: 'translateY(-7px)' }, { opacity: 1, transform: 'translateY(0)' }], 240, 30);
    this.animate(root.querySelector<HTMLElement>('.instruction')!, [{ opacity: 0 }, { opacity: 1 }], 180, 110);
  }
  enterMenu(el: HTMLElement): void {
    this.stop();
    this.animate(el.querySelector<HTMLElement>('.menu-header,header')!, [{ opacity: 0 }, { opacity: 1 }], 180);
    const body = el.querySelector<HTMLElement>('.menu-body,.wheel-body');
    if (body) this.animate(body, [{ opacity: 0, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }], 230, 20);
  }
  pause(el: HTMLElement, opening: boolean): void {
    this.stop();
    if (!opening) { this.fadeCopy(el); return; }
    this.animate(el, [{ opacity: 0 }, { opacity: 1 }], 160);
    this.animate(el.querySelector<HTMLElement>('.pause-card')!, [{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'translateY(-2px) scale(1.01)', offset: .8 }, { opacity: 1, transform: 'translateY(0) scale(1)' }], 240);
  }
  stop(): void { this.animations.forEach(animation => animation.cancel()); this.animations.clear(); this.ghost?.remove(); this.ghost = undefined; }
  dispose(): void { this.stop(); document.removeEventListener('visibilitychange', this.onVisibility); }
}
