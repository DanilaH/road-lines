import { canSpin, localDate, wheelAngle, wheelPrizes, type WheelSpin } from '../core/rewards';
import type { GameSave } from '../services/save';
import type { Feedback } from '../presentation/feedback';
import { rewardArt } from './reward-art';
import { coin, icon } from './icons';
const colors = ['#f6bc4a', '#f5d472', '#f0a45c', '#f5d472', '#f6bc4a', '#f5d472', '#f0a45c', '#f5d472'];
const polar = (r: number, degrees: number) => ({ x: 160 + r * Math.cos(degrees * Math.PI / 180), y: 160 + r * Math.sin(degrees * Math.PI / 180) });
export function wheelSvg(): string {
  return `<svg class="daily-wheel" viewBox="0 0 320 320" aria-label="Восемь равных секторов: ${wheelPrizes.join(', ')} монет">${wheelPrizes.map((amount, i) => {
    const a = polar(148, -112.5 + i * 45), b = polar(148, -67.5 + i * 45), label = polar(104, -90 + i * 45);
    return `<path d="M160 160L${a.x} ${a.y}A148 148 0 0 1 ${b.x} ${b.y}Z" fill="${colors[i]}" stroke="#815625" stroke-width="1.5"/><text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="central" transform="rotate(${i * 45} ${label.x} ${label.y})" fill="#65421e" font-size="22" font-weight="800">${amount}</text>`;
  }).join('')}<circle cx="160" cy="160" r="24" fill="#ffe29a" stroke="#e6aa35" stroke-width="5"/><circle cx="160" cy="160" r="9" fill="#e9b341"/></svg>`;
}
export class WheelView {
  private animation?: Animation;
  private timer?: ReturnType<typeof setTimeout>;
  private finish?: (ok: boolean) => void;
  private sparks: Animation[] = [];
  constructor(private host: HTMLElement, private feedback: Feedback) {
    host.innerHTML = `<header class="menu-header"><button class="tool" data-action="menu-back" aria-label="Назад">${icon('back')}</button><span class="menu-wallet">${coin}<span class="wheel-balance"></span></span></header>
      <div class="wheel-body"><h1 tabindex="-1">Ежедневная награда</h1><p class="wheel-caption">Одна бесплатная попытка каждый день</p><div class="wheel-assembly"><div class="wheel-pointer" aria-hidden="true"></div>${wheelSvg()}<div class="wheel-medallion" aria-hidden="true">${rewardArt('medallion')}</div><div class="wheel-sparks" aria-hidden="true"></div></div>
      <p class="wheel-result" role="status"></p><button class="wheel-spin" data-action="spin">КРУТИТЬ БЕСПЛАТНО</button><p class="wheel-clock"></p><button class="wheel-extra" disabled>${icon('play')} ЕЩЁ РАЗ ЗА ВИДЕО</button><p class="wheel-ad-note">Видео пока недоступно</p></div>`;
  }
  render(save: GameSave, busy: boolean): void {
    this.host.querySelector('.wheel-balance')!.textContent = String(save.coins);
    const button = this.host.querySelector<HTMLButtonElement>('.wheel-spin')!;
    button.disabled = busy || !canSpin(save);
    button.textContent = busy ? 'КРУТИТСЯ…' : canSpin(save) ? 'КРУТИТЬ БЕСПЛАТНО' : 'СЕГОДНЯ УЖЕ ПОЛУЧЕНО';
    this.host.querySelector('.wheel-result')!.textContent = busy ? 'Удачи!' : save.daily.last ? `Выигрыш: +${wheelPrizes[save.daily.last.sector]} монет` : 'Каждый сектор выпадает с одинаковым шансом';
    if (!busy) (this.host.querySelector('.daily-wheel') as SVGElement).style.transform = `rotate(${save.daily.last ? wheelAngle(save.daily.last.sector) % 360 : 0}deg)`;
    this.tick(save);
  }
  tick(save: GameSave): void {
    const now = new Date(), midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), seconds = Math.max(0, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
    this.host.querySelector('.wheel-clock')!.textContent = canSpin(save) ? 'Бесплатная попытка доступна' : save.daily.lastDate && save.daily.lastDate > localDate() ? 'Новая попытка появится после использованной даты' : `До новой попытки: ${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  spin(spin: WheelSpin): Promise<boolean> {
    this.stop(); const wheel = this.host.querySelector<SVGElement>('.daily-wheel')!;
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 180 : 3600;
    return new Promise(resolve => {
      this.finish = resolve;
      try { this.animation = wheel.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${wheelAngle(spin.sector)}deg)` }], { duration, easing: 'cubic-bezier(.12,.65,.12,1)', fill: 'forwards' }); } catch { /* Saved outcome is independent of animation support. */ }
      this.timer = setTimeout(() => { this.finish = undefined; this.animation?.cancel(); this.animation = undefined; resolve(true); }, duration);
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
  stop(): void { clearTimeout(this.timer); this.animation?.cancel(); this.animation = undefined; this.finish?.(false); this.finish = undefined; this.sparks.forEach(a => a.cancel()); this.sparks = []; this.host.querySelector('.wheel-sparks')?.replaceChildren(); }
  dispose(): void { this.stop(); }
}
