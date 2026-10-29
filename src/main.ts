import Phaser from 'phaser';
import { GameplayActivityCoordinator } from '../vendor/mini-games-kit/src/platform/activity';
import { StartupTimeline } from '../vendor/mini-games-kit/src/startup/timeline';
import { getRenderPixelRatio, getBackingStoreSize } from '../vendor/mini-games-kit/src/core/render-density';
import { BoardScene } from './game/BoardScene';
import { installRuntime } from './platform/runtime';
import { coin, icon, star } from './ui/icons';
import { boardLayout } from './ui/layout';
import './style.css';

const timeline = new StartupTimeline<'platform' | 'renderer' | 'ready'>();
const root = document.querySelector<HTMLElement>('#app')!;
const inspect = import.meta.env.VITE_INSPECT === 'true';
const result = inspect && new URLSearchParams(location.search).get('screen') === 'result';
let paused = false;
let disposed = false;
let disposeRuntime = (): void => {};
let frame = 0;
let secondFrame = 0;
let resizeFrame = 0;
const startupDeadline = window.setTimeout(() => {
  const startup = document.querySelector<HTMLElement>('#startup');
  if (startup) startup.textContent = 'Запуск занимает слишком много времени. Перезапусти приложение.';
}, 15_000);
const activity = new GameplayActivityCoordinator(() => {}, () => {});
root.innerHTML = `
  <section class="surface ${result ? 'result' : 'play'}" aria-label="${result ? 'Результат' : 'Игровое поле'}">
    <header class="hud">
      <span class="level">1–3</span>
      <div class="tools">
        <button class="tool" data-action="restart" aria-label="Начать заново">${icon('restart')}</button>
        <span class="wallet" aria-label="40 монет">${coin}<span>40</span><span class="plus">+</span></span>
        <button class="tool hint" disabled aria-label="Подсказка недоступна">${icon('hint')}</button>
        <button class="tool" data-action="pause" aria-label="Пауза">${icon('pause')}</button>
      </div>
    </header>
    <div class="result-heading" ${result ? '' : 'hidden'}><h1>ГОТОВО!</h1><div class="stars" aria-label="Три звезды">${[0, 1, 2].map(star).join('')}</div></div>
    <div id="board" role="img" aria-label="${result ? 'Заполненная фигура' : 'Девять клеток, цветной старт слева сверху'}"></div>
    <p class="instruction" ${result ? 'hidden' : ''}>Начни с цветной клетки</p>
    <div class="rewards" ${result ? '' : 'hidden'}>
      <div class="reward-row"><span class="earned">${coin} +20</span><div class="gift-progress" aria-label="Подарок: 3 из 20"><div class="track"><span></span></div>${icon('gift')}<span class="fraction">3/20</span></div></div>
      <button class="multiply" disabled>${icon('play')} ЗАБРАТЬ ×5</button>
      <button class="next" data-action="next">ДАЛЬШЕ</button>
    </div>
    <div id="banner-slot" aria-hidden="true" ${result ? 'hidden' : ''}></div>
    <section class="pause-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div class="pause-card"><h2 id="pause-title">Пауза</h2><button data-action="resume" class="resume">ПРОДОЛЖИТЬ</button></div>
    </section>
  </section>
  <div id="startup" role="status">Загрузка…</div>`;

const scene = new BoardScene();
const host = document.querySelector<HTMLElement>('#board')!;
let renderRatio = getRenderPixelRatio(2);
scene.setRenderRatio(renderRatio);
const initialSize = getBackingStoreSize(host.clientWidth, host.clientHeight, renderRatio);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: host,
  width: initialSize.width, height: initialSize.height,
  transparent: true, antialias: true, banner: false,
  scale: { mode: Phaser.Scale.NONE },
  audio: { noAudio: true },
  scene, fps: { target: 60 },
});

const unsubscribe = activity.onBlockedChange(blocked => {
  root.dataset.blocked = String(blocked);
  if (game.isBooted) { if (blocked) game.loop.sleep(); else game.loop.wake(); }
});
const overlay = document.querySelector<HTMLElement>('.pause-overlay')!;
const pauseButton = document.querySelector<HTMLButtonElement>('[data-action=pause]')!;
function setPause(value: boolean): void {
  paused = value; overlay.hidden = !value;
  activity.setBlocked('pause', value);
  if (value) document.querySelector<HTMLButtonElement>('[data-action=resume]')!.focus();
  else pauseButton.focus();
}
function onBack(): void { if (!result) setPause(!paused); }
function click(event: MouseEvent): void {
  const target = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  if (!target || target.disabled || (activity.isBlocked() && target.dataset.action !== 'resume')) return;
  switch (target.dataset.action) {
    case 'pause': setPause(true); break;
    case 'resume': setPause(false); break;
    case 'restart': scene.setMiniature(false); break;
    case 'next': location.assign(location.pathname); break;
  }
}
root.addEventListener('click', click);
overlay.addEventListener('keydown', trapFocus);
function trapFocus(event: KeyboardEvent): void {
  if (event.key === 'Tab') { event.preventDefault(); document.querySelector<HTMLButtonElement>('[data-action=resume]')!.focus(); }
}
const resize = new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (disposed) return;
    renderRatio = getRenderPixelRatio(2);
    scene.setRenderRatio(renderRatio);
    const size = getBackingStoreSize(host.clientWidth, host.clientHeight, renderRatio);
    game.scale.resize(size.width, size.height);
    game.canvas.style.width = `${host.clientWidth}px`;
    game.canvas.style.height = `${host.clientHeight}px`;
    const layout = boardLayout(host.clientWidth, host.clientHeight);
    const instruction = document.querySelector<HTMLElement>('.instruction');
    if (instruction) instruction.style.top = `${host.offsetTop + layout.y + layout.height + 24}px`;
  });
});
resize.observe(host);
let rendererReady = false, platformReady = false;
function presentable(): void {
  if (!rendererReady || !platformReady || disposed) return;
  frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
    if (disposed) return;
    timeline.mark('ready');
    clearTimeout(startupDeadline);
    document.querySelector('#startup')?.remove();
    root.dataset.ready = 'true';
    if (inspect) console.info('Road Lines startup', timeline.snapshot({ startToReadyMs: ['start', 'ready'] }));
    if (activity.isBlocked()) game.loop.sleep();
  }); });
}
game.events.once('postrender', () => {
  scene.setMiniature(result); rendererReady = true; timeline.mark('renderer'); presentable();
});
void installRuntime(activity, onBack).then(dispose => {
  if (disposed) { dispose(); return; }
  disposeRuntime = dispose; platformReady = true; timeline.mark('platform');
  activity.setGameplayDesired(!result); presentable();
}).catch(error => {
  activity.setBlocked('startup-error', true);
  const startup = document.querySelector<HTMLElement>('#startup');
  if (startup) startup.textContent = 'Не удалось запустить игру. Перезапусти приложение.';
  console.error('Platform startup failed', error);
  clearTimeout(startupDeadline);
});
function dispose(): void {
  if (disposed) return;
  disposed = true;
  clearTimeout(startupDeadline);
  cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); cancelAnimationFrame(resizeFrame);
  resize.disconnect(); disposeRuntime(); unsubscribe();
  root.removeEventListener('click', click); overlay.removeEventListener('keydown', trapFocus);
  game.destroy(true);
}
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
if (import.meta.hot) import.meta.hot.dispose(dispose);
