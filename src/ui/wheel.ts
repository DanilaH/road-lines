import { canSpin, localDate, wheelAngle, wheelPrizes, type WheelSpin } from '../core/rewards';
import type { GameSave } from '../services/save';
import type { Feedback } from '../presentation/feedback';
import { rewardArt } from './reward-art';
import { coin, icon } from './icons';
const polar = (r: number, degrees: number) => ({ x: 160 + r * Math.cos(degrees * Math.PI / 180), y: 160 + r * Math.sin(degrees * Math.PI / 180) });
export function wheelSvg(): string {
  return `<svg class="daily-wheel" viewBox="0 0 320 320" aria-label="Восемь равных секторов: ${wheelPrizes.join(', ')} монет"><defs><radialGradient id="wheel-purple" cx=".36" cy=".2" r=".85"><stop stop-color="#ac80f4"/><stop offset="1" stop-color="#7140be"/></radialGradient><radialGradient id="wheel-cream" cx=".35" cy=".2" r=".9"><stop stop-color="#fff9de"/><stop offset="1" stop-color="#f2d394"/></radialGradient></defs><circle cx="160" cy="160" r="149" fill="#b57c33"/>${wheelPrizes.map((amount, i) => {
    const a = polar(140, -112.5 + i * 45), b = polar(140, -67.5 + i * 45), label = polar(101, -90 + i * 45);
    return `<g class="wheel-sector" data-sector="${i}"><path d="M160 160L${a.x} ${a.y}A140 140 0 0 1 ${b.x} ${b.y}Z" fill="url(#wheel-${i % 2 ? 'purple' : 'cream'})" stroke="#fff2c0" stroke-opacity=".45" stroke-width="1.2"/><text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="central" transform="rotate(${i * 45} ${label.x} ${label.y})" fill="${i % 2 ? '#fff4d8' : '#634224'}" font-size="21" font-weight="950">${amount}</text></g>`;
  }).join('')}</svg>`;
}
function wheelRim(): string {
  return `<svg class="wheel-rim" viewBox="0 0 320 320" aria-hidden="true"><defs><linearGradient id="wheel-gold" x1=".2" y1="0" x2=".8" y2="1"><stop stop-color="#fff1b8"/><stop offset=".3" stop-color="#fbd775"/><stop offset=".66" stop-color="#d39836"/><stop offset="1" stop-color="#f4cb62"/></linearGradient></defs><circle cx="160" cy="162" r="148" fill="none" stroke="#ac772c" stroke-width="20"/><circle cx="160" cy="158" r="148" fill="none" stroke="url(#wheel-gold)" stroke-width="18"/><circle cx="160" cy="158" r="139" fill="none" stroke="#fff5cc" stroke-width="2" opacity=".8"/>${Array.from({length:16}, (_, i) => { const p = polar(148, i * 22.5); return `<circle cx="${p.x}" cy="${p.y - 2}" r="2.6" fill="#fff3b4" stroke="#c89743" stroke-width=".7"/>`; }).join('')}</svg>`;
}
export class WheelView {
  private animation?: Animation;
  private timer?: ReturnType<typeof setTimeout>;
  private finish?: (ok: boolean) => void;
  private sparks: Animation[] = [];
  constructor(private host: HTMLElement, private feedback: Feedback) {
    host.innerHTML = `<header class="menu-header"><button class="tool" data-action="menu-back" aria-label="Назад">${icon('back')}</button><span class="menu-wallet">${coin}<span class="wheel-balance"></span></span></header>
      <div class="wheel-body"><h1 tabindex="-1">Ежедневная награда</h1><p class="wheel-caption">Одна бесплатная попытка каждый день</p><div class="wheel-assembly"><div class="wheel-pointer" aria-hidden="true"></div>${wheelSvg()}${wheelRim()}<div class="wheel-medallion" aria-hidden="true">${rewardArt('medallion')}</div><div class="wheel-sparks" aria-hidden="true"></div></div>
      <p class="wheel-result" role="status"></p><button class="wheel-spin" data-action="spin">Крутить бесплатно</button><p class="wheel-clock"></p><button class="wheel-extra" disabled>${icon('play')} Ещё раз за видео</button><p class="wheel-ad-note">Видео пока недоступно</p></div>`;
  }
  render(save: GameSave, busy: boolean): void {
    this.host.querySelector('.wheel-balance')!.textContent = String(save.coins);
    const button = this.host.querySelector<HTMLButtonElement>('.wheel-spin')!;
    button.disabled = busy || !canSpin(save);
    button.textContent = busy ? 'Крутится…' : canSpin(save) ? 'Крутить бесплатно' : 'Сегодня уже получено';
    this.host.querySelector('.wheel-result')!.textContent = busy ? 'Удачи!' : save.daily.last ? `Выигрыш: +${wheelPrizes[save.daily.last.sector]} монет` : 'Каждый сектор выпадает с одинаковым шансом';
    this.host.dataset.spinning = String(busy);
    this.host.querySelectorAll<SVGGElement>('.wheel-sector').forEach((node, i) => node.classList.toggle('won', !busy && save.daily.last?.sector === i));
    if (!busy) (this.host.querySelector('.daily-wheel') as SVGElement).style.transform = `rotate(${save.daily.last ? wheelAngle(save.daily.last.sector) % 360 : 0}deg)`;
    this.tick(save);
  }
  tick(save: GameSave): void {
    const now = new Date(), midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), seconds = Math.max(0, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
    this.host.querySelector('.wheel-clock')!.textContent = canSpin(save) ? 'Бесплатная попытка доступна' : save.daily.lastDate && save.daily.lastDate > localDate() ? 'Новая попытка появится после использованной даты' : `До новой попытки: ${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  spin(spin: WheelSpin): Promise<boolean> {
    this.stop(); this.host.dataset.spinning = 'true'; const wheel = this.host.querySelector<SVGElement>('.daily-wheel')!;
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 180 : 3600;
    return new Promise(resolve => {
      this.finish = resolve;
      try { this.animation = wheel.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${wheelAngle(spin.sector)}deg)` }], { duration, easing: 'cubic-bezier(.12,.65,.12,1)', fill: 'forwards' }); } catch { /* Saved outcome is independent of animation support. */ }
      this.timer = setTimeout(() => { this.host.dataset.spinning = 'false'; this.finish = undefined; this.animation?.cancel(); this.animation = undefined; resolve(true); }, duration);
    });
  }
  celebrate(): void {
    this.feedback.play('win'); this.sparks.forEach(a => a.cancel()); this.sparks = [];
    const layer = this.host.querySelector('.wheel-sparks')!; layer.replaceChildren();
    const count = matchMedia('(prefers-reduced-motion: reduce)').matches ? 10 : 36;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i'), angle = i * 2.39996, x = Math.cos(angle) * (90 + i * 2), y = Math.sin(angle) * (90 + i * 2);
      p.style.background = ['#ffe29a', '#9adcbb', '#b5a0ff', '#ff927a'][i % 4]!; layer.append(p);
      try { this.sparks.push(p.animate([{ transform: 'translate(0,0) scale(0)', opacity: 1 }, { transform: `translate(${x}px,${y}px) rotate(${i * 40}deg)`, opacity: 0 }], { duration: 1100, easing: 'cubic-bezier(.12,.7,.3,1)', fill: 'forwards' })); } catch { p.remove(); }
    }
  }
  stop(): void { this.host.dataset.spinning = 'false'; clearTimeout(this.timer); this.animation?.cancel(); this.animation = undefined; this.finish?.(false); this.finish = undefined; this.sparks.forEach(a => a.cancel()); this.sparks = []; this.host.querySelector('.wheel-sparks')?.replaceChildren(); }
  dispose(): void { this.stop(); }
}
