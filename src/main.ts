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
import { Feedback } from './presentation/feedback';
import { WinMotion } from './presentation/motion';
import { ScreenMotion } from './presentation/screens';
import { renderMenu, type Screen } from './ui/menus';
import { isLevelAvailable, isSetAvailable, getLevelSet, levelLabel, nextInSet, type SetId } from './core/progression';
import { getTheme } from './content/themes';
import { applyTheme, themePreview } from './ui/themes';
import { WheelService } from './services/wheel';
import { WheelView } from './ui/wheel';
import { localDate } from './core/rewards';
import { rewardArt } from './ui/reward-art';
import './style.css';
import './ui/shell.css';
let releaseWriter = (): void => {}; 

async function boot(): Promise<void> {
  const timeline = new StartupTimeline<'platform' | 'renderer' | 'ready'>();
  const root = document.querySelector<HTMLElement>('#app')!;
  const inspect = import.meta.env.VITE_INSPECT === 'true';
  const params = new URLSearchParams(location.search);
  const fixture = inspect && params.get('screen') === 'result';
  releaseWriter = await acquireSaveOwnership();
  const store = new GameStore(localStorage);
  const wheelService = new WheelService(store);
  if (store.state.daily.pending) await wheelService.commit();
  applyTheme(root, getTheme(store.state.themeId));
  let level = levels.find(l => l.id === store.state.levelId)!;
  if (inspect && params.has('level')) level = levels[Math.max(0, Math.min(levels.length - 1, Number(params.get('level')) - 1))] ?? level;
  let path = level.id === store.state.levelId ? [...store.state.path] : [level.start];
  if (fixture) { level = levels[2]!; path = [...level.witness]; }
  let result = fixture || complete(level, path), reward = 0;
  if (result && !fixture) reward = store.finish(level, path);
  let viewSetId: SetId = getLevelSet(level.id).id;
  let screen: Screen = fixture || (inspect && params.has('level')) ? 'game' : 'home';
  let themeOrigin: { screen: Screen; paused: boolean } = { screen: 'home', paused: false };
  let pendingTheme: string | null = null;
  let bonus: 'gift' | 'offer' | null = null;
  let wheelBusy = false, wheelPreparing = false, wheelToken = 0;
  let wheelCommit: Promise<void> | null = null;
  const feedback = new Feedback();
  let shownBalance = store.state.coins, collecting = false;
  let paused = false, disposed = false, saveFailed = false, conflict = false, busy = false, revision = 0;
  let hint: number[] = [], rollback: number | null = null, saveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposeRuntime = (): void => {};
  let frame = 0, secondFrame = 0, resizeFrame = 0;
  const activity = new GameplayActivityCoordinator(() => {}, () => {}), hints = new HintService();
  root.innerHTML = `
    <section class="surface" aria-label="Road Lines"><div class="game-content">
      <header class="hud"><span class="level"></span><div class="tools">
        <button class="tool result-theme" data-action="themes" aria-label="Темы" hidden>${icon('palette')}</button>
        <button class="tool result-menu" data-action="home" aria-label="Главное меню" hidden>${icon('home')}</button>
        <button class="tool" data-action="restart" aria-label="Начать заново">${icon('restart')}</button>
        <span class="wallet">${coin}<span class="balance"></span></span>
        <button class="tool hint" data-action="hint" aria-label="Подсказка">${icon('hint')}<small class="hint-count"></small></button>
        <button class="tool" data-action="pause" aria-label="Пауза">${icon('pause')}</button>
      </div></header>
      <div class="result-heading" hidden><h1><span style="--letter:0">Г</span><span style="--letter:1">О</span><span style="--letter:2">Т</span><span style="--letter:3">О</span><span style="--letter:4">В</span><span style="--letter:5">О</span><span style="--letter:6">!</span></h1><div class="stars" aria-label="Три звезды">${[0, 1, 2].map(star).join('')}</div></div>
      <div id="board" tabindex="0" role="group" aria-label="Поле"></div>
      <p class="instruction"></p>
      <div class="rewards" hidden>
        <div class="reward-row"><span class="earned"></span><div class="gift-progress"><div class="track"><span></span></div>${rewardArt('gift')}<span class="fraction"></span></div></div>
        <button class="multiply" disabled>${icon('play')} ЗАБРАТЬ ×5</button>
        <button class="next" data-action="next"><span>ДАЛЬШЕ</span></button>
      </div>
      </div><section class="menu-screen" aria-label="Навигация"></section><section class="wheel-screen" hidden aria-label="Ежедневная награда"></section>
      <div id="banner-slot" aria-hidden="true"></div>
      <section class="pause-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="pause-title"><div class="pause-card"><h2 id="pause-title">Пауза</h2><button data-action="resume" class="resume">ПРОДОЛЖИТЬ</button><div class="pause-navigation"><button data-action="sets">ВЫБОР УРОВНЕЙ</button><button data-action="home">ГЛАВНОЕ МЕНЮ</button><button data-action="themes">ТЕМЫ</button></div><div class="settings"><button data-action="sound" aria-pressed="true"></button><button data-action="vibration" aria-pressed="true"></button></div></div></section>
      <section class="theme-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="theme-title"><div class="theme-purchase">
        <button class="tool purchase-close" data-action="cancel-theme" aria-label="Закрыть покупку">${icon('close')}</button>
        <h2 id="theme-title"></h2><div class="purchase-preview"></div><p class="purchase-balance"></p>
        <button class="primary-action" data-action="buy-theme"></button><p class="purchase-shortage" role="status"></p>
      </div></section>
      <section class="bonus-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="bonus-title"><div class="bonus-card"><h2 id="bonus-title"></h2><div class="bonus-art"></div><p class="bonus-copy"></p><button class="bonus-video" disabled>${icon('play')} ОТКРЫТЬ ЗА ВИДЕО</button><p class="bonus-video-note">Видео пока недоступно</p><button class="bonus-close" data-action="close-bonus"></button></div></section>
      <div class="notice" hidden role="status"><span></span><button data-action="notice"></button></div>
    </section><div id="startup" role="status">Загрузка…</div>`;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const host = $('#board'), scene = new BoardScene();
  let renderRatio = getRenderPixelRatio(2);
  scene.setTheme(getTheme(store.state.themeId));
  scene.setRenderRatio(renderRatio); scene.setState(level, path, hint, result);
  const initialSize = getBackingStoreSize(host.clientWidth, host.clientHeight, renderRatio);
  const game = new Phaser.Game({ type: Phaser.AUTO, parent: host, width: initialSize.width, height: initialSize.height,
    transparent: true, antialias: true, banner: false, scale: { mode: Phaser.Scale.NONE }, audio: { noAudio: true }, scene, fps: { target: 60 } });
  const showBalance = (value: number): void => { shownBalance = value; $('.balance').textContent = String(value); $('.balance').style.fontSize = `${Math.min(19, 78 / Math.max(3, String(value).length))}px`;  $('.wallet').setAttribute('aria-label', `${value} монет`); };
  const motion = new WinMotion(root, feedback, showBalance);
  const screens = new ScreenMotion();
  const wheelView = new WheelView($('.wheel-screen'), feedback);
  root.dataset.winPhase = 'idle';
  const layout = () => boardLayout(host.clientWidth, host.clientHeight, result, level);
  function notice(text: string, action = ''): void {
    $('.notice').hidden = !text; $('.notice span').textContent = text;
    $('.notice button').textContent = action; $('.notice button').hidden = !action;
  }
  function invalidate(): void { revision++; hints.cancel(); busy = false; hint = []; rollback = null; }
  function redraw(): void {
    const index = levels.indexOf(level);
    const theme = getTheme(store.state.themeId); applyTheme(root, theme); scene.setTheme(theme);
    $('.surface').className = `surface ${result ? 'result' : 'play'}`;
    const ruleCount = Number(level.finish !== undefined) + Number(Boolean(level.walls?.length)) + Number(Boolean(level.checkpoints?.length));
    host.classList.toggle('multi-rule', ruleCount > 1);
    root.dataset.screen = screen;
    $('.game-content').style.visibility = screen === 'game' ? 'visible' : 'hidden';
    $('.game-content').inert = screen !== 'game' || paused || bonus !== null;
    $('.game-content').setAttribute('aria-hidden', String(screen !== 'game' || paused || bonus !== null));
    $('.menu-screen').hidden = screen === 'game' || screen === 'wheel';
    $('.wheel-screen').hidden = screen !== 'wheel';
    $('.wheel-screen').inert = bonus !== null;
    if (screen === 'wheel') wheelView.render(store.state, wheelBusy);
    $('.menu-screen').inert = paused || pendingTheme !== null || bonus !== null;
    if (screen !== 'game' && screen !== 'wheel') renderMenu($('.menu-screen'), screen, store.state, viewSetId);
    $('.pause-navigation').hidden = screen !== 'game';
    $('#pause-title').textContent = screen === 'game' ? 'Пауза' : 'Настройки';
    $('[data-action=resume]').textContent = screen === 'game' ? 'ПРОДОЛЖИТЬ' : 'ГОТОВО';
    $('.result-menu').hidden = !result; $('.result-theme').hidden = !result;
    $('.theme-overlay').hidden = pendingTheme === null;
    if (pendingTheme) {
      const item = getTheme(pendingTheme);
      $('#theme-title').textContent = item.name;
      $('.purchase-preview').innerHTML = themePreview(item);
      $('.purchase-balance').textContent = `Баланс: ${store.state.coins} монет`;
      $('[data-action=buy-theme]').textContent = `КУПИТЬ ЗА ${item.price}`;
      $<HTMLButtonElement>('[data-action=buy-theme]').disabled = store.state.coins < item.price || conflict || store.recoveryRequired;
      $('.purchase-shortage').textContent = store.state.coins < item.price ? `Не хватает монет: ${item.price - store.state.coins}.` : 'Покупка за игровые монеты';
    }
    $('.bonus-overlay').hidden = bonus === null; $('.bonus-overlay').dataset.kind = bonus ?? '';
    if (bonus) {
      const offer = store.state.offer;
      $('#bonus-title').textContent = bonus === 'gift' ? 'Подарок!' : 'Новое оформление';
      $('.bonus-art').innerHTML = bonus === 'gift' ? rewardArt('gift', true) : offer ? themePreview(getTheme(offer.themeId)) : '';
      $('.bonus-copy').textContent = bonus === 'gift' ? '+100 монет за 20 новых задач' : offer ? getTheme(offer.themeId).name : '';
      $('.bonus-video').hidden = bonus === 'gift'; $('.bonus-video-note').hidden = bonus === 'gift';
      $('.bonus-close').textContent = bonus === 'gift' ? 'ПРОДОЛЖИТЬ' : 'НЕ СЕЙЧАС';
    }
    $('.level').innerHTML = `<small>Уровень</small><strong>${levelLabel(level.id)}</strong>`;
    showBalance(shownBalance);
    $('[data-action=sound]').textContent = `Звук: ${feedback.settings.sound ? 'вкл' : 'выкл'}`;
    $('[data-action=sound]').setAttribute('aria-pressed', String(feedback.settings.sound));
    $('[data-action=vibration]').textContent = `Вибрация: ${feedback.settings.vibration ? 'вкл' : 'выкл'}`;
    $('[data-action=vibration]').setAttribute('aria-pressed', String(feedback.settings.vibration));
    $('.hint-count').textContent = String(store.state.hints);
    $<HTMLButtonElement>('[data-action=hint]').disabled = busy || result || complete(level, path);
    $<HTMLButtonElement>('[data-action=restart]').disabled = !result && complete(level, path);
    $<HTMLButtonElement>('[data-action=hint]').setAttribute('aria-label', busy ? 'Ищу продолжение' : `Подсказка, осталось ${store.state.hints}`);
    $('.result-heading').hidden = !result; $('.rewards').hidden = !result; $('#banner-slot').hidden = screen !== 'levels' && (screen !== 'game' || result);
    $('.instruction').hidden = result;
    const nextCheckpoint = level.checkpoints?.findIndex(c => !path.includes(c)) ?? -1;
    const ruleCopy = [level.checkpoints?.length ? nextCheckpoint < 0 ? 'Все номера пройдены — заполни оставшиеся клетки' : `Проходи номера по порядку · следующая точка ${nextCheckpoint + 1}` : '',
      level.finish !== undefined ? 'Пустой ромб — последняя клетка' : '', level.walls?.length ? 'Стенки нужно обходить' : ''].filter(Boolean).join('. ');
    $('.instruction').textContent = busy ? 'Ищу продолжение…' : ruleCopy || (path.length === 1 ? 'Начни с цветной клетки' : 'Можно отпустить палец и продолжить');
    $('.earned').innerHTML = fixture ? `${coin} +20` : reward ? `${coin} +${reward}` : 'Уже пройдено';
    const giftCount = store.state.completed.length === 0 ? 0 : (store.state.completed.length - 1) % 20 + 1;
    $('.fraction').textContent = `${giftCount}/20`;
    $('.track span').style.width = `${Math.min(100, giftCount * 5)}%`;
    $('.gift-progress').setAttribute('aria-label', `Подарок: ${giftCount} из 20`);
    $('.next span').textContent = !nextInSet(level.id) ? 'К ВЫБОРУ УРОВНЕЙ' : 'ДАЛЬШЕ';
    host.setAttribute('aria-label', `Задача ${index + 1}. Заполнено ${path.length} из ${level.cells.length}. ${ruleCopy ? ruleCopy + '. ' : ''}Стрелки — движение и откат.`);
    scene.setState(level, path, hint, result);
    activity.setGameplayDesired(screen === 'game' && !result);
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
    try {
      const from = layout(), oldHost = host.getBoundingClientRect();
      reward = store.finish(level, path); saveFailed = false; result = true; invalidate(); input.cancel(); notice('');
      motion.start(reward, store.state.coins, store.state.completed.length, () => { scene.settle(); syncSize(); });
      redraw();
      const newHost = host.getBoundingClientRect();
      scene.win({ ...from, x: from.x + oldHost.x - newHost.x, y: from.y + oldHost.y - newHost.y });
    }
    catch { saveError(); }
  }
  function change(next: number[]): void {
    if (screen !== 'game' || result || activity.isBlocked() || conflict) return;
    const reverse = next.length < path.length;
    invalidate(); path = next; notice(''); redraw(); scene.react(path[path.length - 1]!, reverse);
    feedback.play(reverse ? 'undo' : 'cell', path.length / level.cells.length);
    if (complete(level, path)) finish();
    else { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 80); }
  }
  const input = installRouteInput(host, () => ({ level, path, layout: layout(), blocked: screen !== 'game' || result || activity.isBlocked() || conflict || complete(level, path) }), change, () => { if (!complete(level, path)) flush(); });
  const unsubscribe = activity.onBlockedChange(blocked => {
    root.dataset.blocked = String(blocked);
    feedback.setBlocked(blocked);
    if (blocked) { screens.stop(); cancelWheel(); invalidate(); input.cancel(); flush(); motion.stop(); scene.settle(); showBalance(store.state.coins); }
    redraw();
    if (game.isBooted) { if (blocked) game.loop.sleep(); else if (screen === 'game') game.loop.wake(); }
  });
  function setPause(value: boolean): void {
    if (result && screen === 'game') return;
    if (!value) screens.pause($('.pause-overlay'), false);
    paused = value; $('.pause-overlay').hidden = !value; activity.setBlocked('pause', value);
    redraw(); if (value) screens.pause($('.pause-overlay'), true);
    (value ? $('[data-action=resume]') : screen === 'game' ? $('[data-action=pause]') : $('[data-action=menu-settings]')).focus();
  }
  function onBack(): void {
    if (bonus) { closeBonus(); return; }
    if (pendingTheme) { closeThemePurchase(); return; }
    if (activity.isBlocked() && !paused) return;
    if (paused) setPause(false);
    else if (screen === 'wheel') navigate('home');
    else if (screen === 'themes') returnFromThemes();
    else if (screen === 'levels') navigate('sets');
    else if (screen === 'sets') navigate('home');
    else if (screen === 'game' && result) navigate('home');
    else if (screen === 'game') setPause(true);
  }
  function navigate(next: Exclude<Screen, 'game'>): void {
    if (conflict || store.recoveryRequired) { notice('Нужно заново открыть сохранение.', 'Перезагрузить'); return; }
    input.cancel();
    if (screen === 'wheel') cancelWheel();
    if (!flush()) return;
    invalidate(); motion.stop(); scene.settle(); showBalance(store.state.coins);
    if (next === 'levels' && screen === 'game') viewSetId = getLevelSet(level.id).id;
    screen = next; paused = false; $('.pause-overlay').hidden = true;
    activity.setBlocked('pause', false); notice(''); redraw(); game.loop.sleep();
    screens.enterMenu(screen === 'wheel' ? $('.wheel-screen') : $('.menu-screen'));
    (screen === 'wheel' ? $('.wheel-body h1') : $('.menu-body h1')).focus();
  }
  function showGame(): void {
    if (screen !== 'game' && screen !== 'wheel') screens.leaveMenu($('.menu-screen'));
    else screens.stop();
    screen = 'game'; paused = false; $('.pause-overlay').hidden = true;
    activity.setBlocked('pause', false); notice(''); redraw();
    if (!activity.isBlocked()) game.loop.wake();
    screens.enterGame(root); host.focus();
  }
  function chooseLevel(id: string): void {
    if (conflict || store.recoveryRequired || !isLevelAvailable(id, store.state.completed)) return;
    const selected = levels.find(l => l.id === id)!;
    const saved = store.state.drafts[id]?.path ?? [selected.start];
    const nextPath = complete(selected, saved) ? [selected.start] : [...saved];
    try { store.path(selected, nextPath); } catch { saveError(); return; }
    invalidate(); motion.stop(); scene.settle(); input.cancel();
    level = selected; viewSetId = getLevelSet(level.id).id; path = nextPath; result = false; reward = 0; showBalance(store.state.coins);
    showGame(); scene.open();
  }
  function openThemes(): void {
    const origin = { screen, paused };
    navigate('themes');
    if (screen === 'themes') themeOrigin = origin;
  }
  function returnFromThemes(): void {
    if (themeOrigin.screen === 'game') {
      showGame(); if (themeOrigin.paused) setPause(true);
    } else navigate(themeOrigin.screen === 'themes' ? 'home' : themeOrigin.screen);
  }
  function focusTheme(id: string): void {
    root.querySelector<HTMLButtonElement>(`.theme-card[data-theme-id="${id}"]`)?.focus({ preventScroll: true });
  }
  function closeThemePurchase(): void {
    const id = pendingTheme; pendingTheme = null;
    activity.setBlocked('theme-confirm', false); redraw(); if (id) focusTheme(id);
  }
  function selectTheme(id: string): void {
    if (screen !== 'themes' || conflict || store.recoveryRequired) return;
    if (!store.state.ownedThemes.includes(id)) {
      pendingTheme = getTheme(id).id; redraw(); activity.setBlocked('theme-confirm', true);
      ($<HTMLButtonElement>('[data-action=buy-theme]').disabled ? $('[data-action=cancel-theme]') : $('[data-action=buy-theme]')).focus();
      return;
    }
    try { store.selectTheme(id); } catch { saveError(); return; }
    showBalance(store.state.coins); redraw(); focusTheme(id);
  }
  function buyTheme(): void {
    if (!pendingTheme || conflict || store.recoveryRequired) return;
    const id = pendingTheme;
    try {
      if (store.selectTheme(id) === 'insufficient') { redraw(); return; }
    } catch { saveError(); redraw(); return; }
    showBalance(store.state.coins); closeThemePurchase(); feedback.play('progress');
  }
  function openBonus(kind: 'gift' | 'offer'): void {
    if ((kind === 'gift' && !store.state.giftNotice) || (kind === 'offer' && !store.state.offer)) return;
    if (!flush()) return;
    motion.stop(); showBalance(store.state.coins); bonus = kind; activity.setBlocked('reward-modal', true); redraw(); $('.bonus-close').focus();
  }
  function closeBonus(): void {
    if (!bonus) return;
    try { if (bonus === 'gift') store.acknowledgeGift(); else store.dismissOffer(); } catch { saveError(); return; }
    bonus = null; activity.setBlocked('reward-modal', false); redraw(); feedback.play('progress');
    if (screen === 'game') $('.next').focus(); else $('.menu-body h1').focus();
  }
  function cancelWheel(): void {
    wheelToken++; wheelView.stop();
    if (!wheelPreparing && store.state.daily.pending && !disposed) void settleWheel();
    else if (!wheelPreparing) wheelBusy = false;
  }
  async function settleWheel(celebrate = false): Promise<void> {
    if (wheelPreparing || disposed) return;
    if (wheelCommit) return wheelCommit;
    wheelCommit = (async () => {
      try {
        if (store.state.daily.pending) await wheelService.commit();
        if (disposed) return;
        wheelBusy = false; showBalance(store.state.coins); redraw();
        if (celebrate && screen === 'wheel' && !activity.isBlocked()) wheelView.celebrate();
      } catch { if (!disposed) { wheelBusy = false; saveError(); redraw(); } }
    })().finally(() => { wheelCommit = null; });
    return wheelCommit;
  }
  async function spinWheel(): Promise<void> {
    if (screen !== 'wheel' || wheelBusy || wheelCommit || activity.isBlocked() || conflict || store.recoveryRequired) return;
    wheelBusy = true; wheelPreparing = true; const token = ++wheelToken; redraw();
    let spin;
    try { spin = await wheelService.prepare(localDate()); }
    catch { if (!disposed) { wheelBusy = false; saveError(); redraw(); } return; }
    finally { wheelPreparing = false; }
    if (disposed) return;
    if (token !== wheelToken || screen !== 'wheel' || activity.isBlocked()) { await settleWheel(); return; }
    const shown = await wheelView.spin(spin);
    if (!disposed) await settleWheel(shown && token === wheelToken);
  }
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
    if (!target || target.disabled || (activity.isBlocked() && target.dataset.action !== 'resume' && target.dataset.action !== 'notice' && target.dataset.action !== 'sound' && target.dataset.action !== 'vibration' && !(bonus && target.dataset.action === 'close-bonus') && !(pendingTheme && (target.dataset.action === 'buy-theme' || target.dataset.action === 'cancel-theme')) && !(paused && (target.dataset.action === 'sets' || target.dataset.action === 'home' || target.dataset.action === 'themes')))) return;
    feedback.play('button');
    switch (target.dataset.action) {
      case 'wheel': navigate('wheel'); break;
      case 'spin': void spinWheel(); break;
      case 'gift': openBonus('gift'); break;
      case 'close-bonus': closeBonus(); break;
      case 'themes': openThemes(); break;
      case 'select-theme': selectTheme(target.dataset.themeId!); break;
      case 'buy-theme': buyTheme(); break;
      case 'cancel-theme': closeThemePurchase(); break;
      case 'home': navigate('home'); break;
      case 'sets': navigate('sets'); break;
      case 'open-set':
        if (isSetAvailable(target.dataset.set!, store.state.completed)) { viewSetId = target.dataset.set as SetId; navigate('levels'); }
        break;
      case 'menu-back': onBack(); break;
      case 'continue': showGame(); break;
      case 'choose-level': chooseLevel(target.dataset.level!); break;
      case 'menu-settings': setPause(true); break;
      case 'pause': setPause(true); break;
      case 'resume': setPause(false); break;
      case 'restart': input.cancel(); change([level.start]); flush(); break;
      case 'hint': void requestHint(); break;
      case 'notice':
        if (conflict || store.recoveryRequired) location.reload();
        else if (saveFailed && screen === 'wheel') {
          try { store.reload(); saveFailed = false; notice(''); redraw(); if (store.state.daily.pending) void settleWheel(); } catch { saveError(); }
        }
        else if (saveFailed) { if (complete(level, path)) finish(); else if (flush()) notice(''); }
        else if (rollback !== null) { const p = path.slice(0, rollback); change(p); flush(); }
        break;
      case 'sound': feedback.setSetting('sound', !feedback.settings.sound); redraw(); break;
      case 'vibration': feedback.setSetting('vibration', !feedback.settings.vibration); redraw(); break;
      case 'next': void goNext(); break;
    }
  }
  async function goNext(): Promise<void> {
    if (!result || collecting) return;
    if (fixture) { location.assign(location.pathname); return; }
    if (store.state.giftNotice) { openBonus('gift'); return; }
    if (store.state.offer?.levelId === level.id) { openBonus('offer'); return; }
    collecting = true; $<HTMLButtonElement>('.next').disabled = true;
    const token = revision, done = await motion.collect();
    collecting = false;
    if (!done || disposed || activity.isBlocked() || token !== revision) return;
    const next = nextInSet(level.id);
    if (!next) { navigate('levels'); return; }
    const draft = store.state.drafts[next.id]?.path ?? [next.start];
    const nextPath = complete(next, draft) ? [next.start] : [...draft];
    try { store.path(next, nextPath); } catch { $<HTMLButtonElement>('.next').disabled = false; saveError(); return; }
    motion.stop(); scene.settle(); showBalance(store.state.coins);
    invalidate(); input.cancel(); level = next; path = nextPath; result = false; reward = 0;
    notice(''); redraw(); scene.open(); screens.stop(); screens.enterGame(root);
  }
  const prime = (): void => feedback.prime();
  root.addEventListener('pointerdown', prime, true); root.addEventListener('keydown', prime, true);
  root.addEventListener('click', click);
  const trapFocus = (event: KeyboardEvent): void => {
    if (event.key === 'Tab' && (paused || pendingTheme || bonus)) {
      event.preventDefault(); const buttons = [...root.querySelectorAll<HTMLButtonElement>(bonus ? '.bonus-card button' : pendingTheme ? '.theme-purchase button' : '.pause-card button')].filter(button => !button.disabled && button.getClientRects().length > 0);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]!.focus();
    }
  };
  root.addEventListener('keydown', trapFocus);
  const resize = new ResizeObserver(() => { input.cancel(); syncSize(); }); resize.observe(host);
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== SAVE_KEY && event.key !== null) return;
    conflict = true; activity.setBlocked('save-conflict', true);
    notice('Прогресс изменён в другой вкладке. Открой его заново.', 'Перезагрузить');
  };
  window.addEventListener('storage', onStorage);
  const onViewportResize = (): void => {
    screens.stop(); cancelWheel(); motion.stop(); scene.settle(); showBalance(store.state.coins);
    feedback.setBlocked(true); feedback.setBlocked(activity.isBlocked()); redraw();
  };
  window.addEventListener('resize', onViewportResize);

  let calendar = localDate();
  const clock = setInterval(() => {
    if (disposed || document.hidden) return;
    if (calendar !== localDate()) { calendar = localDate(); redraw(); }
    if (screen === 'wheel') wheelView.tick(store.state);
  }, 1000);
  let rendererReady = false, platformReady = false;
  const deadline = setTimeout(() => { const startup = root.querySelector('#startup'); if (startup) startup.textContent = 'Запуск занимает слишком много времени. Перезапусти приложение.'; }, 15_000);
  function presentable(): void {
    if (!rendererReady || !platformReady || disposed) return;
    frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
      if (disposed) return;
      timeline.mark('ready'); clearTimeout(deadline); root.querySelector('#startup')?.remove(); root.dataset.ready = 'true';
      if (inspect) console.info('Road Lines startup', timeline.snapshot({ startToReadyMs: ['start', 'ready'] }));
      if (activity.isBlocked() || screen !== 'game') game.loop.sleep();
    }); });
  }
  game.events.once('postrender', () => { if (!result) scene.open(); rendererReady = true; timeline.mark('renderer'); presentable(); });
  redraw();

  function dispose(): void {
    if (disposed) return;
    input.dispose(); flush(); disposed = true; invalidate(); clearTimeout(saveTimer); clearTimeout(deadline);
    cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); cancelAnimationFrame(resizeFrame);
    clearInterval(clock); wheelToken++; wheelView.dispose(); wheelService.dispose();
    resize.disconnect(); disposeRuntime(); unsubscribe(); screens.dispose(); motion.dispose(); feedback.dispose(); root.removeEventListener('click', click);
    root.removeEventListener('pointerdown', prime, true); root.removeEventListener('keydown', prime, true);
    window.removeEventListener('resize', onViewportResize); window.removeEventListener('storage', onStorage); window.removeEventListener('pagehide', pagehide);
    root.removeEventListener('keydown', trapFocus); game.destroy(true); releaseWriter();
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
