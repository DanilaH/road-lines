import { diamondPath } from '../presentation/markers';
import { complete, type Level } from '../core/model';
import { levelSets, isLevelAvailable, isSetAvailable, levelLabel, getLevelSet, type SetId } from '../core/progression';
import type { GameSave } from '../services/save';
import { canSpin } from '../core/rewards';
import { themes } from '../content/themes';
import { themePreview } from './themes';
import { rewardArt } from './reward-art';
import { coin, icon } from './icons';

export type Screen = 'game' | 'home' | 'sets' | 'levels' | 'themes' | 'wheel';
const emblem = `<div class="hero-board" aria-hidden="true"><svg class="menu-emblem" viewBox="0 0 240 220"><defs><linearGradient id="hero-ribbon" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="var(--ribbon)"/><stop offset="1" stop-color="color-mix(in srgb,var(--ribbon),black 17%)"/></linearGradient></defs><g class="hero-cells" fill="var(--empty)"><rect x="24" y="26" width="56" height="50" rx="7"/><rect x="92" y="26" width="56" height="50" rx="7"/><rect x="160" y="26" width="56" height="50" rx="7"/><rect x="24" y="88" width="56" height="50" rx="7"/><rect x="92" y="88" width="56" height="50" rx="7"/><rect x="160" y="88" width="56" height="50" rx="7"/><rect x="24" y="150" width="56" height="50" rx="7"/><rect x="92" y="150" width="56" height="50" rx="7"/><rect x="160" y="150" width="56" height="50" rx="7"/></g><path d="M52 51h136v62H52v62h68" fill="none" stroke="color-mix(in srgb,var(--ribbon),black 25%)" stroke-width="50" stroke-linejoin="round" transform="translate(0 6)"/><path d="M52 51h136v62H52v62h68" fill="none" stroke="url(#hero-ribbon)" stroke-width="50" stroke-linejoin="round"/><path d="M30 28h180" stroke="#fff" stroke-opacity=".23" stroke-width="2" stroke-linecap="round"/><path d="M52 51h136v62H52v62h68" fill="none" stroke="var(--trail)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 10"/><path d="${diamondPath(52, 51, 11)}" fill="#fff7e8" stroke="#dac8ae" stroke-width="1"/><circle cx="120" cy="175" r="9" fill="var(--ribbon)" stroke="var(--trail)" stroke-width="3"/><circle cx="188" cy="175" r="3" fill="var(--muted)" opacity=".3"/></svg><i class="hero-spark spark-one">✦</i><i class="hero-spark spark-two">✦</i></div>`;
/** Figure mask only: never reveal the stored solution in navigation. */
function levelMask(level: Level): string {
  const xs = level.cells.map(c => c % level.width), ys = level.cells.map(c => Math.floor(c / level.width));
  const minX = Math.min(...xs), minY = Math.min(...ys), cols = Math.max(...xs) - minX + 1, rows = Math.max(...ys) - minY + 1;
  const step = Math.min(9, 48 / cols, 30 / rows), side = step * .8;
  const x = (56 - cols * step + step - side) / 2, y = (38 - rows * step + step - side) / 2;
  const pos = (c: number) => ({ x: x + (c % level.width - minX) * step, y: y + (Math.floor(c / level.width) - minY) * step });
  const start = pos(level.start);
  const finish = level.finish === undefined ? '' : (() => { const p = pos(level.finish!); return `<path d="${diamondPath(p.x + side / 2, p.y + side / 2, side * .41)}" fill="none" stroke="#c58b37" stroke-width="1"/>`; })();
  const walls = (level.walls ?? []).map(([a, b]) => { const aa = pos(a), bb = pos(b), cx = (aa.x + bb.x + side) / 2, cy = (aa.y + bb.y + side) / 2;
    return `<path d="${aa.y === bb.y ? `M${cx},${cy - side / 2}v${side}` : `M${cx - side / 2},${cy}h${side}`}" stroke="var(--ribbon)" stroke-width="1.2"/>`; }).join('');
  const points = (level.checkpoints ?? []).map(c => { const p = pos(c); return `<circle cx="${p.x + side / 2}" cy="${p.y + side / 2}" r="${side * .2}" fill="var(--ribbon)"/>`; }).join('');
  return `<svg class="level-mask" viewBox="0 0 56 38" aria-hidden="true">${level.cells.map(c => { const p = pos(c); return `<rect x="${p.x}" y="${p.y}" width="${side}" height="${side}" rx="${Math.min(1.3, side * .12)}" fill="currentColor"/>`; }).join('')}<path d="${diamondPath(start.x + side / 2, start.y + side / 2, side * .25)}" fill="var(--panel)"/>${walls}${finish}${points}</svg>`;
}
const smallStars = '<span class="level-stars" aria-hidden="true">★★★</span>';

/** DOM navigation only; the store remains the sole progression writer. */
export function renderMenu(host: HTMLElement, screen: Exclude<Screen, 'game'>, save: GameSave, setId: SetId = 'intro'): void {
  const key = screen === 'levels' ? screen + ':' + setId : screen;
  const scroll = host.dataset.menuScreen === key ? host.querySelector('.menu-body')?.scrollTop ?? 0 : 0;
  host.dataset.menuScreen = key;
  const set = levelSets.find(s => s.id === setId)!;
  const doneCount = set.levels.filter(l => save.completed.includes(l.id)).length;
  const bankTotal = levelSets.reduce((n, s) => n + s.levels.length, 0);
  const bankFinished = save.completed.length === bankTotal;
  const finished = set.levels.every(l => save.completed.includes(l.id));
  const balance = `<span class="menu-wallet" aria-label="${save.coins} монет">${coin}${save.coins}</span>`;
  const heading = screen === 'home' ? '' : `<h1 tabindex="-1">${screen === 'themes' ? 'Темы' : screen === 'sets' ? 'Наборы' : set.title}</h1>`;
  const top = `<header class="menu-header">${screen === 'home' ? `<button class="tool home-settings" data-action="menu-settings" aria-label="Настройки">${icon('settings')}</button>` : `<button class="tool" data-action="menu-back" aria-label="Назад">${icon('back')}</button>`}${balance}</header>`;
  let content: string;
  if (screen === 'home') {
    const continuing = save.path.length > 1;
    const currentSet = getLevelSet(save.levelId), setFinished = currentSet.levels.every(l => save.completed.includes(l.id)) && currentSet.levels.at(-1)?.id === save.levelId && complete(currentSet.levels.at(-1)!, save.path);
    content = `<div class="home-hero"><h1 tabindex="-1">Одной<span>линией</span><i aria-hidden="true">.</i></h1><p>Заполни всё поле</p>${emblem}</div>
      <div class="home-actions"><button class="primary-action home-play" data-action="${setFinished ? 'sets' : 'continue'}"><span class="play-glyph">${icon('play')}</span><span class="play-copy"><strong>${setFinished ? bankFinished ? 'Выбрать задачу' : 'Выбрать набор' : save.completed.includes(save.levelId) && continuing ? 'Результат' : continuing ? 'Продолжить' : 'Играть'}</strong><small>${setFinished ? bankFinished ? 'Все 90 задач пройдены' : 'Набор пройден' : `Уровень ${levelLabel(save.levelId)}`}</small></span><span class="play-arrow" aria-hidden="true">${icon('back')}</span></button>
      <button class="secondary-action home-levels" data-action="sets"><span class="nav-art">${icon('grid')}</span><span>Уровни</span></button><button class="secondary-action home-themes" data-action="themes"><span class="nav-art">${icon('palette')}</span><span>Оформление</span></button></div>
      ${setFinished && continuing ? `<button class="recent-result" data-action="continue">Последний результат · ${levelLabel(save.levelId)}</button>` : ''}
      <button class="daily-entry" data-action="wheel">${rewardArt('medallion')}<span>Ежедневная награда<small>${canSpin(save) ? 'Можно крутить колесо' : 'Сегодня уже получено'}</small></span><b aria-hidden="true">${canSpin(save) ? '→' : '✓'}</b></button>
      ${save.giftNotice ? `<button class="gift-entry" data-action="gift">${rewardArt('gift')} Подарок: +100 монет</button>` : ''}<div class="home-progress"><div><span>Всего пройдено</span><strong>${save.completed.length}<small> / ${bankTotal}</small></strong></div><div class="menu-track"><span style="width:${save.completed.length / bankTotal * 100}%"></span></div></div>`;
  } else if (screen === 'themes') {
    content = `${heading}<p class="menu-caption">Два оформления бесплатно, остальные — за монеты</p><div class="theme-grid">${themes.map(t => {
      const owned = save.ownedThemes.includes(t.id), selected = save.themeId === t.id;
      return `<button class="theme-card ${selected ? 'equipped' : ''} ${owned ? 'owned' : ''}" data-action="select-theme" data-theme-id="${t.id}" aria-pressed="${selected}" aria-label="${t.name}, ${selected ? 'выбрана' : owned ? 'применить' : `${t.price} монет`}">${themePreview(t)}${!owned ? `<i class="theme-lock" aria-hidden="true">${icon('lock')}</i>` : ''}<strong>${t.name}</strong><span>${selected ? `${icon('check')} Выбрана` : owned ? 'Применить' : `${icon('lock')}${coin} ${t.price}`}</span></button>`;
    }).join('')}</div>`;
  } else if (screen === 'sets') {
    content = `${heading}<p class="menu-caption">Выбери набор задач</p><div class="set-list">${levelSets.map(s => {
      const done = s.levels.filter(l => save.completed.includes(l.id)).length;
      return `<button class="set-card" style="--set-color:${s.id === 'intro' ? 'var(--ribbon)' : s.color}" data-action="open-set" data-set="${s.id}" ${isSetAvailable(s.id, save.completed) ? '' : 'disabled'}><span class="set-symbol">${s.levels.length ? levelMask(s.levels[Math.min(11, s.levels.length - 1)]!) : icon('lock')}</span><span class="set-copy"><strong>${s.title}</strong><span>${s.description}</span>${s.levels.length ? `<span class="set-progress"><i style="width:${done / s.levels.length * 100}%"></i></span>` : ''}</span><span class="set-count">${isSetAvailable(s.id, save.completed) ? `${done}/${s.levels.length}` : icon('lock')}</span></button>`;
    }).join('')}</div><p class="bank-caption">${bankTotal} задач в трёх наборах. Новые наборы открываются после первых трёх задач.</p>`;
  } else {
    content = `${heading}<p class="menu-caption">${doneCount} из ${set.levels.length} пройдено</p>${finished ? `<div class="bank-complete"><strong>${bankFinished ? 'Все 90 задач пройдены!' : 'Набор пройден!'}</strong><span>${bankFinished ? 'Можно повторить любую задачу.' : 'Выбери другой набор или повтори любую задачу.'}</span><button class="secondary-action" data-action="sets">Выбрать набор</button></div>` : ''}
      <div class="level-grid">${set.levels.map((l, i) => {
        const done = save.completed.includes(l.id), available = isLevelAvailable(l.id, save.completed), current = l.id === save.levelId;
        const chapter = set.chapters.find(c => c.at === i)?.title ?? '';
        return `${chapter ? `<div class="level-chapter"><span>${chapter}</span><small>${i + 1}–${i + 5}</small></div>` : ''}<button class="level-tile ${done ? 'completed' : ''} ${current ? 'current' : ''}" data-action="choose-level" data-level="${l.id}" ${available ? '' : 'disabled'} ${current ? 'aria-current="step"' : ''} aria-label="Уровень ${i + 1}${done ? ', пройден, три звезды' : available ? ', доступен' : ', закрыт'}"><strong>${i + 1}</strong>${levelMask(l)}${done ? smallStars : available ? '<span class="level-dot" aria-hidden="true"></span>' : icon('lock')}</button>`;
      }).join('')}</div><p class="bank-caption">${finished ? 'Награда за первое прохождение уже получена.' : 'Пройди предыдущую задачу, чтобы открыть следующую.'}</p>`;
  }
  host.innerHTML = `${top}<div class="menu-body ${screen}">${content}</div>`;
  host.querySelector('.menu-body')!.scrollTop = scroll;
}
