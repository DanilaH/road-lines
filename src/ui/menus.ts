import { levelSets, isLevelAvailable } from '../core/progression';
import type { GameSave } from '../services/save';
import { themes } from '../content/themes';
import { themePreview } from './themes';
import { coin, icon } from './icons';

export type Screen = 'game' | 'home' | 'sets' | 'levels' | 'themes';
const emblem = `<svg class="menu-emblem" viewBox="0 0 160 160" aria-hidden="true"><g fill="var(--empty)"><path d="M14 14h38v38H14zM61 14h38v38H61zM108 14h38v38h-38zM14 61h38v38H14zM61 61h38v38H61zM108 61h38v38h-38zM14 108h38v38H14zM61 108h38v38H61zM108 108h38v38h-38z"/></g><path d="M33 33h94v47H33v47h94" stroke="var(--ribbon)" stroke-width="38" fill="none"/><path d="M33 33h94v47H33v47h94" stroke="var(--trail)" stroke-width="3" stroke-dasharray="3 7" fill="none"/><circle cx="33" cy="33" r="7" fill="var(--trail)"/><circle cx="127" cy="127" r="5" fill="var(--trail)"/></svg>`;
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
  const top = `<header class="menu-header">${screen === 'home' ? '<span class="wordmark">ROAD LINES</span>' : `<button class="tool" data-action="menu-back" aria-label="Назад">${icon('back')}</button>`}${balance}</header>`;
  let content: string;
  if (screen === 'home') {
    content = `<div class="home-hero">${emblem}<h1 tabindex="-1">Одной линией</h1><p>Заполни фигуру, не прерывая маршрут</p></div>
      <div class="home-actions"><button class="primary-action" data-action="continue">ПРОДОЛЖИТЬ<span>${save.completed.includes(save.levelId) && save.path.length > 1 ? 'Результат' : 'Уровень'} 1–${index + 1}</span></button>
      <button class="secondary-action" data-action="sets">${icon('grid')} ВЫБОР УРОВНЕЙ</button><button class="secondary-action" data-action="themes">${icon('palette')} ТЕМЫ</button></div>
      <div class="home-progress"><div><span>Пройдено</span><strong>${save.completed.length} / ${set.levels.length}</strong></div><div class="menu-track"><span style="width:${save.completed.length / set.levels.length * 100}%"></span></div></div>
      <button class="quiet-action" data-action="menu-settings">${icon('settings')} ЗВУК И ВИБРАЦИЯ</button>`;
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
