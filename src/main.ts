import Phaser from 'phaser';
import { GameplayActivityCoordinator } from '../vendor/mini-games-kit/src/platform/activity';
import { StartupTimeline } from '../vendor/mini-games-kit/src/startup/timeline';
import { getRenderPixelRatio, getBackingStoreSize } from '../vendor/mini-games-kit/src/core/render-density';
import { BoardScene } from './game/BoardScene';
import { installRuntime } from './platform/runtime';
import { coin, icon, star } from './ui/icons';
import { boardLayout } from './ui/layout';
import { levels } from './content/levels';
import { complete } from './core/model';
import { GameStore, SAVE_KEY } from './services/save';
import { HintService } from './services/hints';
import { installRouteInput } from './services/input';
import { acquireSaveOwnership, SaveOwnershipError } from './services/ownership';
import './style.css';
let releaseWriter = (): void => {}; 

async function boot(): Promise<void> {
  const timeline = new StartupTimeline<'platform' | 'renderer' | 'ready'>();
  const root = document.querySelector<HTMLElement>('#app')!;
  const inspect = import.meta.env.VITE_INSPECT === 'true';
  const params = new URLSearchParams(location.search);
  const fixture = inspect && params.get('screen') === 'result';
  releaseWriter = await acquireSaveOwnership();
  const store = new GameStore(localStorage);
  let level = levels.find(l => l.id === store.state.levelId)!;
  if (inspect && params.has('level')) level = levels[Math.max(0, Math.min(14, Number(params.get('level')) - 1))] ?? level;
  let path = level.id === store.state.levelId ? [...store.state.path] : [level.start];
  if (fixture) { level = levels[2]!; path = [...level.witness]; }
  let result = fixture || complete(level, path), reward = 0;
  if (result && !fixture) reward = store.finish(level, path);
  let paused = false, disposed = false, saveFailed = false, conflict = false, busy = false, revision = 0;
  let hint: number[] = [], rollback: number | null = null, saveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposeRuntime = (): void => {};
  let frame = 0, secondFrame = 0, resizeFrame = 0;
  const activity = new GameplayActivityCoordinator(() => {}, () => {}), hints = new HintService();
  root.innerHTML = `
    <section class="surface" aria-label="Игровое поле">
      <header class="hud"><span class="level"></span><div class="tools">
        <button class="tool" data-action="restart" aria-label="Начать заново">${icon('restart')}</button>
        <span class="wallet">${coin}<span class="balance"></span></span>
        <button class="tool hint" data-action="hint" aria-label="Подсказка">${icon('hint')}<small class="hint-count"></small></button>
        <button class="tool" data-action="pause" aria-label="Пауза">${icon('pause')}</button>
      </div></header>
      <div class="result-heading" hidden><h1>ГОТОВО!</h1><div class="stars" aria-label="Три звезды">${[0, 1, 2].map(star).join('')}</div></div>
      <div id="board" tabindex="0" role="group" aria-label="Поле"></div>
      <p class="instruction"></p>
      <div class="rewards" hidden>
        <div class="reward-row"><span class="earned"></span><div class="gift-progress"><div class="track"><span></span></div>${icon('gift')}<span class="fraction"></span></div></div>
        <button class="multiply" disabled>${icon('play')} ЗАБРАТЬ ×5</button>
        <button class="next" data-action="next">ДАЛЬШЕ</button>
      </div>
      <div id="banner-slot" aria-hidden="true"></div>
      <section class="pause-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="pause-title"><div class="pause-card"><h2 id="pause-title">Пауза</h2><button data-action="resume" class="resume">ПРОДОЛЖИТЬ</button></div></section>
      <div class="notice" hidden role="status"><span></span><button data-action="notice"></button></div>
    </section><div id="startup" role="status">Загрузка…</div>`;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const host = $('#board'), scene = new BoardScene();
  let renderRatio = getRenderPixelRatio(2);
  scene.setRenderRatio(renderRatio); scene.setState(level, path, hint, result);
  const initialSize = getBackingStoreSize(host.clientWidth, host.clientHeight, renderRatio);
  const game = new Phaser.Game({ type: Phaser.AUTO, parent: host, width: initialSize.width, height: initialSize.height,
    transparent: true, antialias: true, banner: false, scale: { mode: Phaser.Scale.NONE }, audio: { noAudio: true }, scene, fps: { target: 60 } });
  const layout = () => boardLayout(host.clientWidth, host.clientHeight, result, level);
  function notice(text: string, action = ''): void {
    $('.notice').hidden = !text; $('.notice span').textContent = text;
    $('.notice button').textContent = action; $('.notice button').hidden = !action;
  }
  function invalidate(): void { revision++; hints.cancel(); busy = false; hint = []; rollback = null; }
  function redraw(): void {
    const index = levels.indexOf(level);
    $('.surface').className = `surface ${result ? 'result' : 'play'}`;
    $('.level').textContent = `1–${index + 1}`;
    $('.balance').textContent = String(store.state.coins);
    $('.wallet').setAttribute('aria-label', `${store.state.coins} монет`);
    $('.hint-count').textContent = String(store.state.hints);
    $<HTMLButtonElement>('[data-action=hint]').disabled = busy || result || complete(level, path);
    $<HTMLButtonElement>('[data-action=restart]').disabled = !result && complete(level, path);
    $<HTMLButtonElement>('[data-action=hint]').setAttribute('aria-label', busy ? 'Ищу продолжение' : `Подсказка, осталось ${store.state.hints}`);
    $('.result-heading').hidden = !result; $('.rewards').hidden = !result; $('#banner-slot').hidden = result;
    $('.instruction').hidden = result;
    $('.instruction').textContent = busy ? 'Ищу продолжение…' : path.length === 1 ? 'Начни с цветной клетки' : 'Можно отпустить палец и продолжить';
    $('.earned').innerHTML = fixture ? `${coin} +20` : reward ? `${coin} +${reward}` : 'Уже пройдено';
    $('.fraction').textContent = `${store.state.completed.length}/20`;
    $('.track span').style.width = `${Math.min(100, store.state.completed.length * 5)}%`;
    $('.gift-progress').setAttribute('aria-label', `Подарок: ${store.state.completed.length} из 20`);
    $('.next').textContent = index === levels.length - 1 ? 'ПРОЙТИ СНОВА' : 'ДАЛЬШЕ';
    host.setAttribute('aria-label', `Задача ${index + 1}. Заполнено ${path.length} из ${level.cells.length}. Стрелки — движение и откат.`);
    scene.setState(level, path, hint, result);
    activity.setGameplayDesired(!result);
    if (inspect) { host.dataset.path = path.join(','); host.dataset.level = level.id; }
    syncSize();
  }
  function syncSize(): void {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (disposed) return;
      renderRatio = getRenderPixelRatio(2); scene.setRenderRatio(renderRatio);
      const size = getBackingStoreSize(host.clientWidth, host.clientHeight, renderRatio);
      if (game.scale.width !== size.width || game.scale.height !== size.height) game.scale.resize(size.width, size.height);
      game.canvas.style.width = `${host.clientWidth}px`; game.canvas.style.height = `${host.clientHeight}px`;
      const l = layout(); $('.instruction').style.top = `${host.offsetTop + l.y + l.height + 24}px`;
    });
  }
  function saveError(): void { saveFailed = true; notice('Не удалось сохранить прогресс.', 'Повторить'); }
  function flush(): boolean {
    clearTimeout(saveTimer);
    if (fixture || conflict || result) return !saveFailed;
    try { store.path(level, path); saveFailed = false; return true; } catch { saveError(); return false; }
  }
  function finish(): void {
    clearTimeout(saveTimer);
    try { reward = store.finish(level, path); saveFailed = false; result = true; invalidate(); input.cancel(); notice(''); redraw(); }
    catch { saveError(); }
  }
  function change(next: number[]): void {
    if (result || activity.isBlocked() || conflict) return;
    invalidate(); path = next; notice(''); redraw();
    if (complete(level, path)) finish();
    else { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 80); }
  }
  const input = installRouteInput(host, () => ({ level, path, layout: layout(), blocked: result || activity.isBlocked() || conflict || complete(level, path) }), change, () => { if (!complete(level, path)) flush(); });
  const unsubscribe = activity.onBlockedChange(blocked => {
    root.dataset.blocked = String(blocked);
    if (blocked) { invalidate(); input.cancel(); flush(); }
    redraw();
    if (game.isBooted) { if (blocked) game.loop.sleep(); else game.loop.wake(); }
  });
  function setPause(value: boolean): void {
    if (result) return;
    paused = value; $('.pause-overlay').hidden = !value; activity.setBlocked('pause', value);
    redraw(); (value ? $('[data-action=resume]') : $('[data-action=pause]')).focus();
  }
  function onBack(): void { setPause(!paused); }
  async function requestHint(): Promise<void> {
    if (busy || result || activity.isBlocked() || complete(level, path)) return;
    if (!store.state.hints) { notice('Подсказки закончились. Можно бесплатно откатить маршрут или начать заново.'); return; }
    input.cancel(); invalidate(); const token = revision;
    busy = true; notice(''); redraw();
    const answer = await hints.request(level, path);
    if (disposed || token !== revision || !answer || result || activity.isBlocked()) return;
    busy = false;
    if (answer.kind === 'FOUND') {
      try { store.write({ ...store.state, levelId: level.id, levelVersion: level.version, path: [...path], hints: store.state.hints - 1 });
        hint = answer.path.slice(path.length - 1, path.length + 3); notice('Бледная линия показывает продолжение.'); }
      catch { saveError(); }
    } else if (answer.kind === 'UNSOLVABLE') {
      rollback = answer.rollbackLength ?? null;
      notice(rollback !== null ? `Этот маршрут зашёл в тупик. Вернуться на ${path.length - rollback} клеток?` : 'Этот маршрут зашёл в тупик. Попробуй откатить несколько клеток.', rollback !== null ? 'Вернуться' : '');
    } else notice('Сейчас не удалось найти продолжение. Подсказка не потрачена.');
    redraw();
  }
  function click(event: MouseEvent): void {
    const target = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!target || target.disabled || (activity.isBlocked() && target.dataset.action !== 'resume' && target.dataset.action !== 'notice')) return;
    switch (target.dataset.action) {
      case 'pause': setPause(true); break;
      case 'resume': setPause(false); break;
      case 'restart': input.cancel(); change([level.start]); flush(); break;
      case 'hint': void requestHint(); break;
      case 'notice':
        if (conflict || store.recoveryRequired) location.reload();
        else if (saveFailed) { if (complete(level, path)) finish(); else if (flush()) notice(''); }
        else if (rollback !== null) { const p = path.slice(0, rollback); change(p); flush(); }
        break;
      case 'next': {
        if (!result) break;
        if (fixture) { location.assign(location.pathname); break; }
        const next = levels[(levels.indexOf(level) + 1) % levels.length]!;
        try { store.path(next, [next.start]); } catch { saveError(); break; }
        invalidate(); input.cancel(); level = next; path = [next.start]; result = false; reward = 0; notice(''); redraw(); break;
      }
    }
  }
  root.addEventListener('click', click);
  const trapFocus = (event: KeyboardEvent): void => {
    if (event.key === 'Tab' && paused) { event.preventDefault(); $('[data-action=resume]').focus(); }
  };
  $('.pause-overlay').addEventListener('keydown', trapFocus);
  const resize = new ResizeObserver(() => { input.cancel(); syncSize(); }); resize.observe(host);
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== SAVE_KEY && event.key !== null) return;
    conflict = true; activity.setBlocked('save-conflict', true);
    notice('Прогресс изменён в другой вкладке. Открой его заново.', 'Перезагрузить');
  };
  window.addEventListener('storage', onStorage);
  let rendererReady = false, platformReady = false;
  const deadline = setTimeout(() => { const startup = root.querySelector('#startup'); if (startup) startup.textContent = 'Запуск занимает слишком много времени. Перезапусти приложение.'; }, 15_000);
  function presentable(): void {
    if (!rendererReady || !platformReady || disposed) return;
    frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
      if (disposed) return;
      timeline.mark('ready'); clearTimeout(deadline); root.querySelector('#startup')?.remove(); root.dataset.ready = 'true';
      if (inspect) console.info('Road Lines startup', timeline.snapshot({ startToReadyMs: ['start', 'ready'] }));
      if (activity.isBlocked()) game.loop.sleep();
    }); });
  }
  game.events.once('postrender', () => { rendererReady = true; timeline.mark('renderer'); presentable(); });
  redraw();

  function dispose(): void {
    if (disposed) return;
    input.dispose(); flush(); disposed = true; invalidate(); clearTimeout(saveTimer); clearTimeout(deadline);
    cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); cancelAnimationFrame(resizeFrame);
    resize.disconnect(); disposeRuntime(); unsubscribe(); root.removeEventListener('click', click);
    window.removeEventListener('storage', onStorage); window.removeEventListener('pagehide', pagehide);
    $('.pause-overlay').removeEventListener('keydown', trapFocus); game.destroy(true); releaseWriter();
  }
  const pagehide = (event: PageTransitionEvent): void => { flush(); if (!event.persisted) dispose(); };
  window.addEventListener('pagehide', pagehide);
  if (import.meta.hot) import.meta.hot.dispose(dispose);
  try { const dispose = await installRuntime(activity, onBack); if (disposed) dispose(); else { disposeRuntime = dispose; platformReady = true; timeline.mark('platform'); presentable(); } }
  catch (error) { activity.setBlocked('startup-error', true); clearTimeout(deadline); $('#startup').textContent = 'Не удалось запустить игру. Перезапусти приложение.'; console.error(error); }
}
void boot().catch(error => {
  releaseWriter();
  document.querySelector('#app')!.innerHTML = '<div class="fatal" role="alert"><p>Не удалось прочитать сохранение. Прогресс не сброшен.</p><button onclick="location.reload()">Попробовать снова</button></div>';
  if (error instanceof SaveOwnershipError) document.querySelector('.fatal p')!.textContent = error.message;
  console.error('Startup failed', error);
});
