import { levelSets, isLevelAvailable } from '../core/progression';
import type { GameSave } from '../services/save';
import { canSpin } from '../core/rewards';
import { themes } from '../content/themes';
import { themePreview } from './themes';
import { rewardArt } from './reward-art';
import { coin, icon } from './icons';

export type Screen = 'game' | 'home' | 'sets' | 'levels' | 'themes' | 'wheel';
const emblem = `<div class="hero-board" aria-hidden="true"><svg class="menu-emblem" viewBox="0 0 240 220"><defs><linearGradient id="hero-ribbon" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="var(--ribbon)"/><stop offset="1" stop-color="color-mix(in srgb,var(--ribbon),black 17%)"/></linearGradient></defs><g class="hero-cells" fill="var(--empty)"><rect x="24" y="26" width="56" height="50" rx="7"/><rect x="92" y="26" width="56" height="50" rx="7"/><rect x="160" y="26" width="56" height="50" rx="7"/><rect x="24" y="88" width="56" height="50" rx="7"/><rect x="92" y="88" width="56" height="50" rx="7"/><rect x="160" y="88" width="56" height="50" rx="7"/><rect x="24" y="150" width="56" height="50" rx="7"/><rect x="92" y="150" width="56" height="50" rx="7"/><rect x="160" y="150" width="56" height="50" rx="7"/></g><path d="M52 51h136v62H52v62h68" fill="none" stroke="color-mix(in srgb,var(--ribbon),black 25%)" stroke-width="50" stroke-linejoin="round" transform="translate(0 6)"/><path d="M52 51h136v62H52v62h68" fill="none" stroke="url(#hero-ribbon)" stroke-width="50" stroke-linejoin="round"/><path d="M30 28h180" stroke="#fff" stroke-opacity=".23" stroke-width="2" stroke-linecap="round"/><path d="M52 51h136v62H52v62h68" fill="none" stroke="var(--trail)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 10"/><circle cx="52" cy="51" r="10" fill="var(--trail)"/><circle cx="120" cy="175" r="9" fill="var(--ribbon)" stroke="var(--trail)" stroke-width="3"/><circle cx="188" cy="175" r="3" fill="var(--muted)" opacity=".3"/></svg><i class="hero-spark spark-one">✦</i><i class="hero-spark spark-two">✦</i></div>`;
const smallStars = '<span class="level-stars" aria-hidden="true">★★★</span>';

/** DOM navigation only; the store remains the sole progression writer. */
export function renderMenu(host: HTMLElement, screen: Exclude<Screen, 'game'>, save: GameSave): void {
  const scroll = host.dataset.menuScreen === screen ? host.querySelector('.menu-body')?.scrollTop ?? 0 : 0;
  host.dataset.menuScreen = screen;
  const set = levelSets[0];
  const index = set.levels.findIndex(l => l.id === save.levelId);
  const finished = set.levels.every(l => save.completed.includes(l.id));
  const balance = `<span class="menu-wallet" aria-label="${save.coins} монет">${coin}${save.coins}</span>`;
  const heading = screen === 'home' ? '' : `<h1 tabindex="-1">${screen === 'themes' ? 'Темы' : screen === 'sets' ? 'Наборы' : set.title}</h1>`;
  const top = `<header class="menu-header">${screen === 'home' ? `<button class="tool home-settings" data-action="menu-settings" aria-label="Настройки">${icon('settings')}</button>` : `<button class="tool" data-action="menu-back" aria-label="Назад">${icon('back')}</button>`}${balance}</header>`;
  let content: string;
  if (screen === 'home') {
    const continuing = save.path.length > 1;
    content = `<div class="home-hero"><h1 tabindex="-1">Одной<span>линией</span><i aria-hidden="true">.</i></h1><p>Заполни всё поле</p>${emblem}</div>
      <div class="home-actions"><button class="primary-action home-play" data-action="continue"><span class="play-glyph">${icon('play')}</span><span class="play-copy"><strong>${save.completed.includes(save.levelId) && continuing ? 'Результат' : continuing ? 'Продолжить' : 'Играть'}</strong><small>Уровень 1–${index + 1}</small></span><span class="play-arrow" aria-hidden="true">${icon('back')}</span></button>
      <button class="secondary-action home-levels" data-action="sets"><span class="nav-art">${icon('grid')}</span><span>Уровни</span></button><button class="secondary-action home-themes" data-action="themes"><span class="nav-art">${icon('palette')}</span><span>Оформление</span></button></div>
      <button class="daily-entry" data-action="wheel">${rewardArt('medallion')}<span>Ежедневная награда<small>${canSpin(save) ? 'Можно крутить колесо' : 'Сегодня уже получено'}</small></span><b aria-hidden="true">${canSpin(save) ? '→' : '✓'}</b></button>
      ${save.giftNotice ? `<button class="gift-entry" data-action="gift">${rewardArt('gift')} Подарок: +100 монет</button>` : ''}<div class="home-progress"><div><span>Первый набор</span><strong>${save.completed.length}<small> / ${set.levels.length}</small></strong></div><div class="menu-track"><span style="width:${save.completed.length / set.levels.length * 100}%"></span></div></div>`;
  } else if (screen === 'themes') {
    content = `${heading}<p class="menu-caption">Два оформления бесплатно, остальные — за монеты</p><div class="theme-grid">${themes.map(t => {
      const owned = save.ownedThemes.includes(t.id), selected = save.themeId === t.id;
      return `<button class="theme-card ${selected ? 'equipped' : ''}" data-action="select-theme" data-theme-id="${t.id}" aria-pressed="${selected}" aria-label="${t.name}, ${selected ? 'выбрана' : owned ? 'применить' : `${t.price} монет`}">${themePreview(t)}<strong>${t.name}</strong><span>${selected ? `${icon('check')} Выбрана` : owned ? 'Применить' : `${icon('lock')}${coin} ${t.price}`}</span></button>`;
    }).join('')}</div>`;
  } else if (screen === 'sets') {
    content = `${heading}<p class="menu-caption">Выбери набор задач</p><div class="set-list">${levelSets.map(s => {
      const done = s.levels.filter(l => save.completed.includes(l.id)).length;
      return `<button class="set-card" style="--set-color:${s.color}" data-action="open-set" ${s.levels.length ? '' : 'disabled'}><span class="set-symbol">${icon(s.levels.length ? 'grid' : 'lock')}</span><span class="set-copy"><strong>${s.title}</strong><span>${s.description}</span>${s.levels.length ? `<span class="set-progress"><i style="width:${done / s.levels.length * 100}%"></i></span>` : ''}</span><span class="set-count">${s.levels.length ? `${done}/${s.levels.length}` : 'Скоро'}</span></button>`;
    }).join('')}</div><p class="bank-caption">Сейчас доступны ${set.levels.length} задач первого набора.</p>`;
  } else {
    content = `${heading}<p class="menu-caption">${save.completed.length} из ${set.levels.length} пройдено</p>${finished ? '<div class="bank-complete"><strong>Набор пройден!</strong><span>Можно вернуться к любой задаче.</span></div>' : ''}
      <div class="level-grid">${set.levels.map((l, i) => {
        const done = save.completed.includes(l.id), available = isLevelAvailable(l.id, save.completed), current = l.id === save.levelId;
        return `<button class="level-tile ${done ? 'completed' : ''} ${current ? 'current' : ''}" data-action="choose-level" data-level="${l.id}" ${available ? '' : 'disabled'} ${current ? 'aria-current="step"' : ''} aria-label="Уровень ${i + 1}${done ? ', пройден, три звезды' : available ? ', доступен' : ', закрыт'}"><strong>${i + 1}</strong>${done ? smallStars : available ? '<span class="level-dot" aria-hidden="true"></span>' : icon('lock')}</button>`;
      }).join('')}</div><p class="bank-caption">${finished ? 'Награда за первое прохождение уже получена.' : 'Пройди предыдущую задачу, чтобы открыть следующую.'}</p>`;
  }
  host.innerHTML = `${top}<div class="menu-body ${screen}">${content}</div>`;
  host.querySelector('.menu-body')!.scrollTop = scroll;
}
