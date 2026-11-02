import { copy, language, loadLanguage, setLanguage, chooseLanguage, isLanguage, translateMarkup, themeName } from './i18n';
import { instruction, type GestureCoach } from './ui/instructions';
import Phaser from 'phaser';
import { GameplayActivityCoordinator } from '../vendor/mini-games-kit/src/platform/activity';
import { StartupTimeline } from '../vendor/mini-games-kit/src/startup/timeline';
import { getRenderPixelRatio, getBackingStoreSize } from '../vendor/mini-games-kit/src/core/render-density';
import { BoardScene } from './game/BoardScene';
import { destroyRenderer } from './platform/destroy-renderer';
import { installRuntime } from './platform/runtime';
import { coin, icon, star } from './ui/icons';
import { layoutReader } from './ui/layout';
import { levels } from './content/levels';
import { complete, type MoveBlock } from './core/model';
import { GameStore, SAVE_KEY } from './services/save';
import { HintService } from './services/hints';
import { installRouteInput } from './services/input';
import { installThumbControls } from './services/thumb-controls';
import { acquireSaveOwnership, SaveOwnershipError } from './services/ownership';
import { Feedback } from './presentation/feedback';
import { WinMotion } from './presentation/motion';
import { ScreenMotion } from './presentation/screens';
import { renderMenu, type Screen } from './ui/menus';
import { isLevelAvailable, isSetAvailable, getLevelSet, levelLabel, nextLevel, type SetId } from './core/progression';
import { getTheme, themes } from './content/themes';
import { applyTheme, themePreview } from './ui/themes';
import { WheelService } from './services/wheel';
import { WheelView } from './ui/wheel';
import { localDate } from './core/rewards';
import { rewardArt } from './ui/reward-art';
import { GameAnalytics, levelInfo } from './services/analytics';
import { createAnalyticsAdapter } from './platform/analytics';
import { wheelPrizes } from './core/rewards';
import './style.css';
import './ui/shell.css';
try { loadLanguage(localStorage); } catch { setLanguage('ru'); }
const initialStartup = document.querySelector('#startup'); if (initialStartup) initialStartup.textContent = copy.loading;
const analytics = new GameAnalytics(createAnalyticsAdapter());
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
  if (store.state.daily.pending) { const spin = store.state.daily.pending; await wheelService.commit(); analytics.event('wheel_reward', { sector: spin.sector, amount: wheelPrizes[spin.sector]!, recovered: true }); }
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
  let pendingTheme: string | null = null, previewTheme: string | null = null;
  let resultThemeIndex = 0;
  let bonus: 'gift' | 'offer' | null = null;
  let continueAfterBonus = false;
  let paidHint: { key: string; path: number[] } | null = null;
  let rejectionReason: MoveBlock | null = null, lastReject = -Infinity;
  const coach: GestureCoach = { released: false, backtracked: false };
  let coachLevel = level.id, languageSaveFailed = false;
  let rejectionTimer: ReturnType<typeof setTimeout> | undefined;
  let wheelBusy = false, wheelPreparing = false, wheelToken = 0;
  let wheelCommit: Promise<void> | null = null;
  const feedback = new Feedback();
  let shownBalance = store.state.coins, collecting = false;
  let paused = false, disposed = false, saveFailed = false, conflict = false, busy = false, revision = 0;
  let hint: number[] = [], rollback: number | null = null, saveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposeRuntime = (): void => {};
  let frame = 0, secondFrame = 0, resizeFrame = 0, renderFrame = 0;
  const activity = new GameplayActivityCoordinator(() => {}, () => {}), hints = new HintService();
  root.innerHTML = `
    <section class="surface" aria-label="Road Lines"><div class="game-content">
      <header class="hud"><span class="level"></span><div class="tools">
        <button class="tool result-theme" data-action="themes" data-i18n-aria="themes" aria-label="${copy.themes}" hidden>${icon('palette')}</button>
        <button class="tool result-menu" data-action="home" data-i18n-aria="home" aria-label="${copy.home}" hidden>${icon('home')}</button>

        <span class="wallet">${coin}<span class="balance"></span></span>

        <button class="tool" data-action="pause" data-i18n-aria="pause" aria-label="${copy.pause}">${icon('pause')}</button>
      </div></header>
      <div class="result-heading" hidden><h1 data-language="${language}" aria-label="${copy.won}">${[...copy.won].map((letter, i) => `<span style="--letter:${i}" aria-hidden="true">${letter}</span>`).join('')}</h1><div class="stars" data-i18n-aria="threeStars" aria-label="${copy.threeStars}">${[0, 1, 2].map(star).join('')}</div></div>
      <div id="board" tabindex="0" role="group" data-i18n-aria="board" aria-label="${copy.board}"></div>
      <p class="instruction"></p>
      <div class="play-controls"><button class="route-action reset-action" data-action="restart" data-i18n-aria="restart" aria-label="${copy.restart}">${icon('restart')}<span data-i18n="resetShort">${copy.resetShort}</span></button><button class="route-action hint-action" data-action="hint" data-i18n-aria="hint" aria-label="${copy.hint}">${icon('hint')}<span data-i18n="hint">${copy.hint}</span><small class="hint-count"></small></button></div>
      <div class="rewards" hidden>
        <div class="reward-row"><span class="earned"></span><div class="gift-progress"><div class="track"><span></span></div>${rewardArt('gift')}<span class="fraction"></span></div></div>
        <button class="multiply" disabled hidden>${icon('play')} <span data-i18n="multiply">${copy.multiply}</span></button>
        <div class="result-theme-card"><div class="result-theme-preview"></div><div class="result-theme-copy"><strong></strong><small></small></div><button data-action="try-result-theme"></button><button class="cycle-theme" data-action="cycle-result-theme" data-i18n-aria="anotherTheme" aria-label="${copy.anotherTheme}">${icon('back')}</button></div>
        <button class="next" data-action="next"><span data-i18n="next">${copy.next}</span></button>
      </div>
      </div><section class="menu-screen" data-i18n-aria="navigation" aria-label="${copy.navigation}"></section><section class="wheel-screen" hidden data-i18n-aria="daily" aria-label="${copy.daily}"></section>
      <div id="banner-slot" aria-hidden="true"></div>
      <section class="pause-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="pause-title"><div class="pause-card"><h2 id="pause-title">${copy.pause}</h2><button data-action="resume" class="resume">${copy.resume}</button><div class="pause-navigation"><button data-action="sets" data-i18n="levelSelection">${copy.levelSelection}</button><button data-action="home" data-i18n="homeCaps">${copy.homeCaps}</button><button data-action="themes" data-i18n="themesCaps">${copy.themesCaps}</button></div><div class="settings"><button data-action="sound" aria-pressed="true"></button><button data-action="vibration" aria-pressed="true"></button></div><div class="language-setting"><span data-i18n="language">${copy.language}</span><div role="group" data-i18n-aria="language" aria-label="${copy.language}"><button data-action="language" data-language="ru" lang="ru" aria-pressed="true">Русский</button><button data-action="language" data-language="en" lang="en" aria-pressed="false">English</button></div><small class="language-status" role="status"></small></div></div></section>
      <section class="theme-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="theme-title"><div class="theme-purchase">
        <button class="tool purchase-close" data-action="cancel-theme" data-i18n-aria="closePurchase" aria-label="${copy.closePurchase}">${icon('close')}</button>
        <h2 id="theme-title"></h2><div class="purchase-preview"></div><p class="purchase-balance"></p>
        <button class="primary-action" data-action="buy-theme"></button><p class="purchase-shortage" role="status"></p>
      </div></section>
      <section class="bonus-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="bonus-title"><div class="bonus-card"><h2 id="bonus-title"></h2><div class="bonus-art"></div><p class="bonus-copy"></p><button class="bonus-video" disabled>${icon('play')} <span data-i18n="openVideo">${copy.openVideo}</span></button><p class="bonus-video-note" data-i18n="videoUnavailable">${copy.videoUnavailable}</p><button class="bonus-close" data-action="close-bonus"></button></div></section>
      <div class="notice" hidden role="status"><span></span><button data-action="notice"></button></div>
    </section><div id="startup" role="status">${copy.loading}</div>`;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  await document.fonts.load('900 16px "Road Nunito"').catch(() => []);
  const host = $('#board'), scene = new BoardScene();
  let renderRatio = getRenderPixelRatio(2);
  scene.setTheme(getTheme(store.state.themeId));
  scene.setRenderRatio(renderRatio); scene.setState(level, path, hint, result);
  const initialSize = getBackingStoreSize(host.clientWidth, host.clientHeight, renderRatio);
  const game = new Phaser.Game({ type: Phaser.AUTO, parent: host, width: initialSize.width, height: initialSize.height,
    transparent: true, antialias: true, banner: false, scale: { mode: Phaser.Scale.NONE }, audio: { noAudio: true }, scene, fps: { target: 60 } });
  scene.setWakeHandler(() => {
    if (renderFrame || disposed || screen !== 'game' || activity.isBlocked() || !game.loop.started || game.loop.running) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      if (!disposed && screen === 'game' && !activity.isBlocked() && !game.loop.running) game.loop.wake();
    });
  });
  const showBalance = (value: number): void => { shownBalance = value; $('.balance').textContent = String(value); $('.balance').style.fontSize = `${Math.min(19, 78 / Math.max(3, String(value).length))}px`;  $('.wallet').setAttribute('aria-label', copy.coins(value)); };
  const motion = new WinMotion(root, feedback, showBalance);
  const screens = new ScreenMotion();
  const wheelView = new WheelView($('.wheel-screen'), feedback);
  root.dataset.winPhase = 'idle';
  const readLayout = layoutReader();
  const layout = () => readLayout(host.clientWidth, host.clientHeight, result, level);
  let noticeState: { text: string | (() => string); action: string | (() => string) } = { text: '', action: '' };
  function refreshNotice(): void {
    const text = typeof noticeState.text === 'function' ? noticeState.text() : noticeState.text;
    const action = typeof noticeState.action === 'function' ? noticeState.action() : noticeState.action;
    root.dataset.notice = String(Boolean(text));
    $('.notice').hidden = !text; $('.notice span').textContent = text;
    $('.notice button').textContent = action; $('.notice button').hidden = !action;
  }
  function notice(text: string | (() => string), action: string | (() => string) = ''): void { noticeState = { text, action }; refreshNotice(); }
  function invalidate(keepHelp = false): void { revision++; hints.cancel(); busy = false;
    if (!keepHelp) { hint = []; rollback = null; }
    clearTimeout(rejectionTimer); rejectionReason = null; }
  function updateRouteUI(): void {
    const nextCheckpoint = level.checkpoints?.findIndex(c => !path.includes(c)) ?? -1;
    if (coachLevel !== level.id) { coach.released = false; coach.backtracked = false; coachLevel = level.id; }
    const ruleCopy = [level.checkpoints?.length ? nextCheckpoint < 0 ? copy.pointsDone : copy.nextPoint(nextCheckpoint + 1) : '',
      level.finish !== undefined ? copy.finishMarker : '', level.walls?.length ? copy.avoidWalls : ''].filter(Boolean).join(' · ');
    const rejectionText = rejectionReason === 'wall' ? copy.wallRejected : rejectionReason === 'finish' ? copy.finishLast : rejectionReason === 'checkpoint' ? copy.pointRejected(nextCheckpoint + 1) : '';
    $('.instruction').textContent = rejectionText || (busy ? copy.search : instruction(level, path, store.state.completed, coach));
    $('.instruction').classList.toggle('rejected', Boolean(rejectionText));
    $<HTMLButtonElement>('[data-action=hint]').disabled = busy || result || complete(level, path);
    $('[data-action=hint]').setAttribute('aria-label', busy ? copy.searchAria : copy.hintAria(store.state.hints));
    host.setAttribute('aria-label', copy.boardAria(levels.indexOf(level) + 1, path.length, level.cells.length, ruleCopy));
    scene.setState(level, path, hint, result);
    if (inspect) { host.dataset.path = path.join(','); host.dataset.level = level.id; }
  }
  function rejectMove(cell: number, reason: MoveBlock): void {
    if (result || screen !== 'game' || activity.isBlocked() || conflict || performance.now() - lastReject < 380) return;
    lastReject = performance.now();
    rejectionReason = reason;
    updateRouteUI(); scene.reject(cell); feedback.play('reject');
    clearTimeout(rejectionTimer); rejectionTimer = setTimeout(() => { rejectionReason = null; if (!disposed) updateRouteUI(); }, 1500);
  }
  function redraw(): void {
    translateMarkup(root); refreshNotice();
    const title = $('.result-heading h1');
    if (title.dataset.language !== language) {
      title.innerHTML = [...copy.won].map((letter, i) => `<span style="--letter:${i}" aria-hidden="true">${letter}</span>`).join('');
      title.dataset.language = language; title.setAttribute('aria-label', copy.won);
    }
    for (const button of root.querySelectorAll<HTMLElement>('[data-action=language]')) button.setAttribute('aria-pressed', String(button.dataset.language === language));
    $('.language-status').textContent = languageSaveFailed ? copy.languageUnsaved : '';
    const theme = getTheme(previewTheme ?? store.state.themeId); applyTheme(root, theme); scene.setTheme(theme);
    $('.surface').className = `surface ${result ? 'result' : 'play'}`;
    const ruleCount = Number(level.finish !== undefined) + Number(Boolean(level.walls?.length)) + Number(Boolean(level.checkpoints?.length));
    host.classList.toggle('multi-rule', ruleCount > 1);
    root.dataset.screen = screen;
    $('.game-content').style.visibility = screen === 'game' ? 'visible' : 'hidden';
    $('.game-content').inert = screen !== 'game' || paused || bonus !== null || pendingTheme !== null;
    $('.game-content').setAttribute('aria-hidden', String(screen !== 'game' || paused || bonus !== null || pendingTheme !== null));
    $('.menu-screen').hidden = screen === 'game' || screen === 'wheel';
    $('.wheel-screen').hidden = screen !== 'wheel';
    $('.wheel-screen').inert = bonus !== null;
    if (screen === 'wheel') wheelView.render(store.state, wheelBusy);
    $('.menu-screen').inert = paused || pendingTheme !== null || bonus !== null;
    if (screen !== 'game' && screen !== 'wheel') renderMenu($('.menu-screen'), screen, store.state, viewSetId);
    $('.pause-navigation').hidden = screen !== 'game';
    $('#pause-title').textContent = screen === 'game' ? copy.pause : copy.settings;
    $('[data-action=resume]').textContent = screen === 'game' ? copy.resume : copy.done;
    $('.result-menu').hidden = !result; $('.result-theme').hidden = !result;
    $('.theme-overlay').hidden = pendingTheme === null;
    if (pendingTheme) {
      const item = getTheme(pendingTheme);
      $('#theme-title').textContent = themeName(item.id);
      $('.purchase-preview').innerHTML = themePreview(item);
      $('.purchase-balance').textContent = copy.balance(store.state.coins);
      $('[data-action=buy-theme]').textContent = copy.buyFor(item.price);
      $<HTMLButtonElement>('[data-action=buy-theme]').disabled = store.state.coins < item.price || conflict || store.recoveryRequired;
      $('.purchase-shortage').textContent = store.state.coins < item.price ? copy.shortage(item.price - store.state.coins) : copy.coinPurchase;
    }
    $('.bonus-overlay').hidden = bonus === null; $('.bonus-overlay').dataset.kind = bonus ?? '';
    if (bonus) {
      const offer = store.state.offer;
      $('#bonus-title').textContent = bonus === 'gift' ? copy.gift : copy.newTheme;
      $('.bonus-art').innerHTML = bonus === 'gift' ? rewardArt('gift', true) : offer ? themePreview(getTheme(offer.themeId)) : '';
      $('.bonus-copy').textContent = bonus === 'gift' ? copy.giftReward : offer ? themeName(offer.themeId) : '';
      $('.bonus-video').hidden = bonus === 'gift'; $('.bonus-video-note').hidden = bonus === 'gift';
      $('.bonus-close').textContent = bonus === 'gift' ? copy.resume : copy.notNow;
    }
    $('.level').innerHTML = `<small>${copy.level}</small><strong>${levelLabel(level.id)}</strong>`;
    showBalance(shownBalance);
    $('[data-action=sound]').textContent = copy.sound(feedback.settings.sound);
    $('[data-action=sound]').setAttribute('aria-pressed', String(feedback.settings.sound));
    $('[data-action=vibration]').textContent = copy.vibration(feedback.settings.vibration);
    $('[data-action=vibration]').setAttribute('aria-pressed', String(feedback.settings.vibration));
    $('.hint-count').textContent = String(store.state.hints);
    $<HTMLButtonElement>('[data-action=hint]').disabled = busy || result || complete(level, path);
    $<HTMLButtonElement>('[data-action=restart]').disabled = !result && complete(level, path);
    $<HTMLButtonElement>('[data-action=hint]').setAttribute('aria-label', busy ? copy.searchAria : copy.hintAria(store.state.hints));
    $('.result-heading').hidden = !result; $('.rewards').hidden = !result; $('#banner-slot').hidden = screen !== 'levels' && (screen !== 'game' || result);
    $('.instruction').hidden = result;
    $('.earned').innerHTML = fixture ? `${coin} +20` : reward ? `${coin} +${reward}` : copy.alreadyCompleted;
    const giftCount = store.state.completed.length === 0 ? 0 : (store.state.completed.length - 1) % 20 + 1;
    $('.fraction').textContent = `${giftCount}/20`;
    $('.track span').style.width = `${Math.min(100, giftCount * 5)}%`;
    $('.gift-progress').setAttribute('aria-label', copy.giftProgress(giftCount));
    $('.next span').textContent = !nextLevel(level.id) ? copy.toLevels : copy.next;
    if (result) {
      const candidate = resultTheme();
      $('[data-action=cycle-result-theme]').hidden = themes.filter(t => !store.state.ownedThemes.includes(t.id)).length <= 1;
      $('.result-theme-preview').innerHTML = themePreview(candidate);
      $('.result-theme-copy strong').textContent = themeName(candidate.id);
      $('.result-theme-copy small').textContent = previewTheme === candidate.id ? copy.previewFree : store.state.ownedThemes.includes(candidate.id) ? copy.themes : copy.themePrice(candidate.price);
      $('[data-action=try-result-theme]').textContent = store.state.ownedThemes.includes(candidate.id) ? copy.chooseTheme : previewTheme === candidate.id ? copy.buyFor(candidate.price) : copy.tryTheme;
    }
    updateRouteUI();
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
      const resized = game.scale.width !== size.width || game.scale.height !== size.height;
      if (resized) game.scale.resize(size.width, size.height);
      game.canvas.style.width = `${host.clientWidth}px`; game.canvas.style.height = `${host.clientHeight}px`;
      const l = layout(); $('.instruction').style.top = `${host.offsetTop + l.y + l.height + 24}px`;
      // A sleeping renderer loses its framebuffer on resize. Paint once without unblocking input/audio.
      if (resized && game.isBooted && screen === 'game' && !game.loop.running && !document.hidden) {
        game.events.once('postrender', () => { if (activity.isBlocked() || screen !== 'game') game.loop.sleep(); });
        game.loop.wake();
      }
    });
  }
  function saveError(operation = 'write'): void { analytics.saveError(operation); saveFailed = true; notice(() => copy.saveFailed, () => copy.retry); }
  function flush(): boolean {
    clearTimeout(saveTimer);
    if (fixture || conflict || result) return !saveFailed;
    try { store.path(level, path); saveFailed = false; return true; } catch { saveError(); return false; }
  }
  function finish(): void {
    clearTimeout(saveTimer);
    try {
      const from = layout(), oldHost = host.getBoundingClientRect();
      reward = store.finish(level, path); analytics.finish(reward); saveFailed = false; result = true; invalidate(); input.cancel(); notice('');
      motion.start(reward, store.state.coins, store.state.completed.length, () => { scene.settle(); syncSize(); });
      redraw();
      const newHost = host.getBoundingClientRect();
      scene.win({ ...from, x: from.x + oldHost.x - newHost.x, y: from.y + oldHost.y - newHost.y });
    }
    catch { saveError(); }
  }
  function change(next: number[], kind: 'gesture' | 'reset' | 'rollback' = 'gesture'): void {
    if (screen !== 'game' || result || activity.isBlocked() || conflict) return;
    const reverse = next.length < path.length;
    analytics.move(path.length, next.length, kind);
    invalidate(); path = next; notice(''); updateRouteUI(); scene.react(path[path.length - 1]!, reverse);
    feedback.play(reverse ? 'undo' : 'cell', path.length / level.cells.length);
    if (complete(level, path)) finish();
    else { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 80); }
  }
  const input = installRouteInput(host, () => ({ level, path, layout: layout(), blocked: screen !== 'game' || result || activity.isBlocked() || conflict || complete(level, path) }), next => { if (next.length < path.length) coach.backtracked = true; change(next); }, () => { if (!complete(level, path)) { if (path.length > 1) coach.released = true; flush(); scene.resumeHead(); updateRouteUI(); } }, rejectMove, $('.surface'));
  const unsubscribe = activity.onBlockedChange(blocked => {
    root.dataset.blocked = String(blocked); analytics.block(blocked);
    feedback.setBlocked(blocked);
    // Confirmed help still describes the same prefix across lifecycle blockers.
    if (blocked) { screens.stop(); cancelWheel(); invalidate(true); input.cancel(); flush(); motion.stop(); scene.settle(); showBalance(store.state.coins); }
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
    if (bonus) { closeBonus(false); return; }
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
    if (conflict || store.recoveryRequired) { notice(() => copy.needReload, () => copy.reload); return; }
    input.cancel();
    if (screen === 'wheel') cancelWheel();
    if (!flush()) return;
    analytics.leave(next); previewTheme = null;
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
    if (!result) analytics.enter(level, path.length, store.state.completed.includes(level.id));
    screen = 'game'; paused = false; $('.pause-overlay').hidden = true;
    activity.setBlocked('pause', false); notice(''); redraw();
    if (!activity.isBlocked()) game.loop.wake();
    screens.enterGame(root); scene.resumeHead(); host.focus();
  }
  function chooseLevel(id: string): void {
    if (conflict || store.recoveryRequired || !isLevelAvailable(id, store.state.completed)) return;
    const selected = levels.find(l => l.id === id)!;
    const saved = store.state.drafts[id]?.path ?? [selected.start];
    const nextPath = complete(selected, saved) ? [selected.start] : [...saved];
    try { store.path(selected, nextPath); } catch { saveError(); return; }
    analytics.leave('selection'); previewTheme = null;
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
    activity.setBlocked('theme-confirm', false); redraw(); if (screen === 'game') $('[data-action=try-result-theme]').focus(); else if (id) focusTheme(id);
  }
  function resultTheme() {
    const candidates = themes.filter(t => !store.state.ownedThemes.includes(t.id));
    return candidates[resultThemeIndex % Math.max(1, candidates.length)] ?? getTheme(store.state.themeId);
  }
  function tryResultTheme(): void {
    if (screen !== 'game' || !result || conflict || store.recoveryRequired) return;
    const candidate = resultTheme();
    if (store.state.ownedThemes.includes(candidate.id)) { openThemes(); return; }
    if (previewTheme !== candidate.id) { previewTheme = candidate.id; redraw(); return; }
    pendingTheme = candidate.id; redraw(); activity.setBlocked('theme-confirm', true);
    ($<HTMLButtonElement>('[data-action=buy-theme]').disabled ? $('[data-action=cancel-theme]') : $('[data-action=buy-theme]')).focus();
  }
  function selectTheme(id: string): void {
    if (screen !== 'themes' || conflict || store.recoveryRequired) return;
    if (!store.state.ownedThemes.includes(id)) {
      pendingTheme = getTheme(id).id; redraw(); activity.setBlocked('theme-confirm', true);
      ($<HTMLButtonElement>('[data-action=buy-theme]').disabled ? $('[data-action=cancel-theme]') : $('[data-action=buy-theme]')).focus();
      return;
    }
    try { if (store.selectTheme(id) === 'equipped') analytics.event('theme_selected', { theme: id }); } catch { saveError(); return; }
    showBalance(store.state.coins); redraw(); focusTheme(id);
  }
  function buyTheme(): void {
    if (!pendingTheme || conflict || store.recoveryRequired) return;
    const id = pendingTheme;
    try {
      const purchase = store.selectTheme(id);
      if (purchase === 'insufficient') { redraw(); return; }
      if (purchase === 'purchased') analytics.event('theme_purchase', { theme: id, price: getTheme(id).price });
    } catch { saveError(); redraw(); return; }
    previewTheme = null; showBalance(store.state.coins); closeThemePurchase(); feedback.play('progress');
  }
  function openBonus(kind: 'gift' | 'offer'): void {
    if ((kind === 'gift' && !store.state.giftNotice) || (kind === 'offer' && !store.state.offer)) return;
    if (!flush()) return;
    motion.stop(); showBalance(store.state.coins); bonus = kind; activity.setBlocked('reward-modal', true); redraw(); $('.bonus-close').focus();
  }
  function closeBonus(proceed = true): void {
    if (!bonus) return;
    try { if (bonus === 'gift') store.acknowledgeGift(); else store.dismissOffer(); } catch { saveError(); return; }
    const resume = continueAfterBonus && proceed; continueAfterBonus = false;
    bonus = null; activity.setBlocked('reward-modal', false); redraw(); feedback.play('progress');
    if (resume && screen === 'game' && result && !activity.isBlocked()) { void goNext(); return; }
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
        if (store.state.daily.pending) { const spin = store.state.daily.pending; await wheelService.commit(); analytics.event('wheel_reward', { sector: spin.sector, amount: wheelPrizes[spin.sector]!, recovered: false }); }
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
    const key = `${level.id}:${level.version}:${path.join(',')}`;
    if (paidHint?.key === key) { analytics.event('hint_repeat', levelInfo(level)); hint = [...paidHint.path]; notice(() => copy.hintShown); updateRouteUI(); return; }
    const info = levelInfo(level); analytics.event('hint_request', info);
    input.cancel(); invalidate(); const token = revision;
    busy = true; notice(''); redraw();
    const answer = await hints.request(level, path);
    if (disposed || token !== revision || !answer || result || activity.isBlocked()) { analytics.event('hint_result', { ...info, outcome: 'cancelled' }); return; }
    busy = false;
    if (answer.kind === 'FOUND') {
      if (!store.state.hints) { analytics.event('hint_result', { ...info, outcome: 'no_budget' }); notice(() => copy.noHints); redraw(); return; }
      try { store.write({ ...store.state, levelId: level.id, levelVersion: level.version, path: [...path], hints: store.state.hints - 1 });
        analytics.event('hint_spent', { ...info, remaining: store.state.hints }); analytics.event('hint_result', { ...info, outcome: 'found' });
        hint = answer.path.slice(path.length - 1, path.length + 3); paidHint = { key, path: [...hint] }; notice(() => copy.hintShown); }
      catch { analytics.event('hint_result', { ...info, outcome: 'save_failed' }); saveError('hint'); }
    } else if (answer.kind === 'UNSOLVABLE') {
      analytics.event('hint_result', { ...info, outcome: 'dead_end' });
      rollback = answer.rollbackLength ?? null;
      const count = path.length - (rollback ?? path.length);
      notice(rollback !== null ? () => copy.deadEndReturn(count) : () => copy.deadEnd, rollback !== null ? () => copy.return : '');
    } else { analytics.event('hint_result', { ...info, outcome: 'unknown' }); notice(() => copy.unknown); }
    redraw();
  }
  function click(event: MouseEvent): void {
    const target = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!target || target.disabled || (activity.isBlocked() && target.dataset.action !== 'resume' && target.dataset.action !== 'notice' && target.dataset.action !== 'sound' && target.dataset.action !== 'vibration' && !(bonus && target.dataset.action === 'close-bonus') && !(pendingTheme && (target.dataset.action === 'buy-theme' || target.dataset.action === 'cancel-theme')) && !(paused && (target.dataset.action === 'sets' || target.dataset.action === 'home' || target.dataset.action === 'themes' || target.dataset.action === 'language')))) return;
    feedback.play('button');
    switch (target.dataset.action) {
      case 'wheel': navigate('wheel'); break;
      case 'spin': void spinWheel(); break;
      case 'gift': openBonus('gift'); break;
      case 'close-bonus': closeBonus(); break;
      case 'themes': openThemes(); break;
      case 'try-result-theme': tryResultTheme(); break;
      case 'cycle-result-theme': if (screen === 'game' && result) { resultThemeIndex++; previewTheme = null; redraw(); } break;
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
      case 'restart': input.cancel(); change([level.start], 'reset'); flush(); break;
      case 'hint': void requestHint(); break;
      case 'notice':
        if (conflict || store.recoveryRequired) location.reload();
        else if (saveFailed && screen === 'wheel') {
          try { store.reload(); saveFailed = false; notice(''); redraw(); if (store.state.daily.pending) void settleWheel(); } catch { saveError(); }
        }
        else if (saveFailed) { if (complete(level, path)) finish(); else if (flush()) notice(''); }
        else if (rollback !== null) { const p = path.slice(0, rollback); change(p, 'rollback'); flush(); }
        break;
      case 'language': {
        const next = target.dataset.language;
        if (!paused || !isLanguage(next) || (next === language && !languageSaveFailed)) break;
        try { languageSaveFailed = !chooseLanguage(next, localStorage); } catch { setLanguage(next); languageSaveFailed = true; }
        analytics.event('language_change', { language, saved: !languageSaveFailed });
        redraw(); root.querySelector<HTMLButtonElement>(`[data-action=language][data-language=${language}]`)?.focus(); break;
      }
      case 'sound': feedback.setSetting('sound', !feedback.settings.sound); redraw(); break;
      case 'vibration': feedback.setSetting('vibration', !feedback.settings.vibration); redraw(); break;
      case 'next': void goNext(); break;
    }
  }
  async function goNext(): Promise<void> {
    if (!result || collecting || screen !== 'game' || activity.isBlocked() || conflict || store.recoveryRequired) return;
    if (fixture) { location.assign(location.pathname); return; }
    if (store.state.giftNotice) { openBonus('gift'); continueAfterBonus = bonus === 'gift'; return; }
    // Video is intentionally deferred: acknowledge the old offer without interrupting Continue.
    if (store.state.offer?.levelId === level.id) { try { store.dismissOffer(); } catch { saveError(); return; } }
    collecting = true; $<HTMLButtonElement>('.next').disabled = true;
    const token = revision, done = await motion.collect();
    collecting = false;
    if (!done || disposed || activity.isBlocked() || token !== revision) return;
    const next = nextLevel(level.id);
    if (!next) { navigate('levels'); return; }
    const draft = store.state.drafts[next.id]?.path ?? [next.start];
    const nextPath = complete(next, draft) ? [next.start] : [...draft];
    try { store.path(next, nextPath); } catch { $<HTMLButtonElement>('.next').disabled = false; saveError(); return; }
    motion.stop(); scene.settle(); showBalance(store.state.coins);
    previewTheme = null; invalidate(); input.cancel(); level = next; path = nextPath; result = false; reward = 0;
    notice(''); redraw(); analytics.enter(level, path.length, store.state.completed.includes(level.id)); scene.open(); screens.stop(); screens.enterGame(root);
  }
  const prime = (): void => feedback.prime();
  root.addEventListener('pointerdown', prime, true); root.addEventListener('keydown', prime, true);
  root.addEventListener('click', click);
  const disposeThumbControls = installThumbControls(root);
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
    if (!conflict) analytics.event('save_conflict', {});
    conflict = true; activity.setBlocked('save-conflict', true);
    notice(() => copy.conflict, () => copy.reload);
  };
  window.addEventListener('storage', onStorage);
  const onViewportResize = (): void => {
    screens.stop(); cancelWheel(); motion.stop(); scene.settle(); showBalance(store.state.coins);
    feedback.setBlocked(true); feedback.setBlocked(activity.isBlocked()); redraw();
  };
  window.addEventListener('resize', onViewportResize);

  let calendar = localDate();
  const clock = setInterval(() => {
    if (disposed || root.dataset.background === 'true') return;
    if (calendar !== localDate()) { calendar = localDate(); redraw(); }
    if (screen === 'wheel') wheelView.tick(store.state);
  }, 1000);
  let rendererReady = false, platformReady = false, readyReported = false;
  const deadline = setTimeout(() => { const startup = root.querySelector('#startup'); if (startup) startup.textContent = copy.slowStart; }, 15_000);
  function presentable(): void {
    if (!rendererReady || !platformReady || disposed) return;
    frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
      if (disposed) return;
      clearTimeout(deadline); root.querySelector('#startup')?.remove();
      if (activity.isBlocked() || screen !== 'game') game.loop.sleep();
      // Removing the covering element is not a painted, touch-ready frame yet.
      // Publish readiness after the uncovered UI has crossed a paint boundary.
      frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
        if (disposed) return;
        timeline.mark('ready'); root.dataset.ready = 'true';
        if (!readyReported) { readyReported = true; analytics.event('app_ready', { language }); }
        if (inspect) console.info('Road Lines startup', timeline.snapshot({ startToReadyMs: ['start', 'ready'] }));
      }); });
    }); });
  }
  game.events.once('postrender', () => { if (!result) scene.open(); rendererReady = true; timeline.mark('renderer'); presentable(); });
  redraw();
  if (screen === 'game' && !result) analytics.enter(level, path.length, store.state.completed.includes(level.id));

  function dispose(): void {
    if (disposed) return;
    input.dispose(); flush(); analytics.dispose(); disposed = true; root.dataset.background = 'true'; invalidate(); clearTimeout(saveTimer); clearTimeout(rejectionTimer); clearTimeout(deadline);
    cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); cancelAnimationFrame(resizeFrame); cancelAnimationFrame(renderFrame);
    clearInterval(clock); wheelToken++; wheelView.dispose(); wheelService.dispose();
    resize.disconnect(); disposeRuntime(); unsubscribe(); screens.dispose(); motion.dispose(); feedback.dispose(); disposeThumbControls(); root.removeEventListener('click', click);
    root.removeEventListener('pointerdown', prime, true); root.removeEventListener('keydown', prime, true);
    window.removeEventListener('resize', onViewportResize); window.removeEventListener('storage', onStorage); window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow);
    root.removeEventListener('keydown', trapFocus); destroyRenderer(game, releaseWriter);
  }
  const pageshow = (event: PageTransitionEvent): void => { if (event.persisted && screen === 'game' && !result && !disposed) analytics.enter(level, path.length, store.state.completed.includes(level.id)); };
  window.addEventListener('pageshow', pageshow);
  const pagehide = (event: PageTransitionEvent): void => { analytics.leave('pagehide'); flush(); if (!event.persisted) dispose(); };
  window.addEventListener('pagehide', pagehide);
  if (import.meta.hot) import.meta.hot.dispose(dispose);
  try { const dispose = await installRuntime(activity, onBack, background => { root.dataset.background = String(background); }); if (disposed) dispose(); else { disposeRuntime = dispose; platformReady = true; timeline.mark('platform'); presentable(); } }
  catch (error) { activity.setBlocked('startup-error', true); clearTimeout(deadline); $('#startup').textContent = copy.failedStart; console.error(error); }
}
void boot().catch(error => {
  analytics.event('startup_error', { reason: error instanceof SaveOwnershipError ? 'ownership' : 'save_or_boot' });
  releaseWriter();
  document.querySelector('#app')!.innerHTML = `<div class="fatal" role="alert"><p>${copy.failedSave}</p><button onclick="location.reload()">${copy.tryAgain}</button></div>`;
  if (error instanceof SaveOwnershipError) document.querySelector('.fatal p')!.textContent = error.message;
  console.error('Startup failed', error);
});
