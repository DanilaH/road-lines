export type Language = 'ru' | 'en';
export const LANGUAGE_KEY = 'road-lines.locale.v1';
const noun = (n: number, one: string, few: string, many: string): string => n % 100 >= 11 && n % 100 <= 14 ? many : n % 10 === 1 ? one : n % 10 >= 2 && n % 10 <= 4 ? few : many;
const ruCoins = (n: number): string => `${n} ${noun(n, 'монета', 'монеты', 'монет')}`;
const ru = {
  rewardRecoveryFailed: 'Не удалось проверить рекламную награду. Попробуй ещё раз.',
  hintShop: 'Подсказки', hintShopCaption: 'Покажут следующие клетки маршрута', buyHintSingle: '1 подсказка · 60', buyHintPack: '3 подсказки · 150', adCoins: '+150 монет · видео', adLoading: 'Загружаю видео…', adUnavailable: 'Видео сейчас недоступно. Можно попробовать позже.', adGranted: 'Получено 150 монет', hintBought: 'Подсказки куплены', getCoins: 'ПОПОЛНИТЬ МОНЕТЫ',

  previewActive: 'ПРИМЕРЯЕМ', rareTheme: 'ТЕМА', rareChance: 'Новая тема — шанс 1 из 8', allThemesWheel: 'Все темы собраны — в секторе темы 300 монет', themeWon: (name: string): string => `Получена тема «${name}»`, giftMilestone: (n: number): string => `За ${n} пройденных задач`,
  resetShort: 'Сброс', anotherTheme: 'Другая тема', previewFree: 'Примерка — бесплатно', chooseTheme: 'ВЫБРАТЬ', tryTheme: 'ПРИМЕРИТЬ', themePrice: (n: number): string => `${n} монет`,
  loading: 'Загрузка…', themes: 'Темы', home: 'Главное меню', restart: 'Начать заново', hint: 'Подсказка', pause: 'Пауза',
  won: 'ГОТОВО!', threeStars: 'Три звезды', board: 'Поле', navigation: 'Навигация', daily: 'Ежедневная награда', settings: 'Настройки', back: 'Назад',
  resume: 'ПРОДОЛЖИТЬ', done: 'ГОТОВО', levelSelection: 'ВЫБОР УРОВНЕЙ', homeCaps: 'ГЛАВНОЕ МЕНЮ', themesCaps: 'ТЕМЫ',
  closePurchase: 'Закрыть покупку', multiply: 'ЗАБРАТЬ ×5', openVideo: 'ОТКРЫТЬ ЗА ВИДЕО', videoUnavailable: 'Видео пока недоступно',
  level: 'Уровень', alreadyCompleted: 'Уже пройдено', toLevels: 'К ВЫБОРУ УРОВНЕЙ', next: 'ДАЛЬШЕ', notNow: 'НЕ СЕЙЧАС',
  gift: 'Подарок!', newTheme: 'Новое оформление', giftReward: '+100 монет за 20 новых задач', coinPurchase: 'Покупка за игровые монеты',
  search: 'Ищу продолжение…', searchAria: 'Ищу продолжение', pointsDone: 'Номера пройдены — заполни поле', finishMarker: 'Пустой ромб — финиш',
  avoidWalls: 'Обходи стенки', finishLast: 'Финиш — после всех клеток', start: 'Начни со светлого ромба', continueHead: 'Веди пальцем в нужную сторону',
  wallRejected: 'Здесь стенка — обойди её', fill: 'Заполни всё поле одной линией', releaseTip: 'Можно отпустить палец и продолжить',
  resumeTip: 'Продолжи с конца линии', undoStart: 'Нарисуй линию. Назад по ней — откат', undoTip: 'Веди по линии назад, чтобы откатить', undoDone: 'Откат бесплатный. Заполни всё поле',
  hintShown: 'Бледная линия показывает продолжение.', noHints: 'Подсказки закончились. Проведи по линии назад или начни заново.',
  deadEnd: 'Этот маршрут зашёл в тупик. Попробуй откатить несколько клеток.', unknown: 'Сейчас не удалось найти продолжение. Подсказка не потрачена.',
  return: 'Вернуться', saveFailed: 'Не удалось сохранить прогресс.', retry: 'Повторить', reload: 'Перезагрузить', needReload: 'Нужно заново открыть сохранение.',
  conflict: 'Прогресс изменён в другой вкладке. Открой его заново.', slowStart: 'Запуск занимает слишком много времени. Перезапусти приложение.',
  failedStart: 'Не удалось запустить игру. Перезапусти приложение.', failedSave: 'Не удалось прочитать сохранение. Прогресс не сброшен.', tryAgain: 'Попробовать снова',
  openElsewhere: 'Игра уже открыта в другой вкладке. Закрой её и попробуй снова.', language: 'Язык', languageUnsaved: 'Язык изменён, но сохранить выбор не удалось.',
  logoFirst: 'Одной', logoSecond: 'линией', homeTagline: 'Заполни всё поле', chooseTask: 'Выбрать задачу', chooseSet: 'Выбрать набор',
  bankDone: 'Все 90 задач пройдены', setDone: 'Набор пройден', result: 'Результат', continue: 'Продолжить', play: 'Играть', levels: 'Уровни', appearance: 'Оформление',
  dailyAvailable: 'Можно крутить колесо', dailyClaimed: 'Сегодня уже получено', giftEntry: 'Подарок: +100 монет', totalCompleted: 'Всего пройдено',
  themeCaption: 'Два оформления бесплатно, остальные — за монеты', selected: 'Выбрана', apply: 'Применить', selectedAria: 'выбрана', applyAria: 'применить',
  sets: 'Наборы', chooseSetCaption: 'Выбери набор задач', bankCaption: '90 задач в трёх наборах. Новые наборы открываются после первых трёх задач.',
  bankDoneTitle: 'Все 90 задач пройдены!', setDoneTitle: 'Набор пройден!', repeatAny: 'Можно повторить любую задачу.', anotherSet: 'Выбери другой набор или повтори любую задачу.',
  rewardAlreadyReceived: 'Награда за первое прохождение уже получена.', previousFirst: 'Пройди предыдущую задачу, чтобы открыть следующую.',
  dailyCaption: 'Одна бесплатная попытка каждый день', spinFree: 'Крутить бесплатно', spinVideo: 'Ещё раз за видео', spinning: 'Крутится…', goodLuck: 'Удачи!',
  equalChance: 'Каждый сектор выпадает с одинаковым шансом', spinAvailable: 'Бесплатная попытка доступна', futureDate: 'Новая попытка появится после использованной даты',
  coins: ruCoins,
  balance: (n: number): string => `Баланс: ${ruCoins(n)}`,
  buyFor: (n: number): string => `КУПИТЬ ЗА ${n}`,
  shortage: (n: number): string => `Не хватает монет: ${n}.`,
  sound: (on: boolean): string => `Звук: ${on ? 'вкл' : 'выкл'}`,
  vibration: (on: boolean): string => `Вибрация: ${on ? 'вкл' : 'выкл'}`,
  nextPoint: (n: number): string => `Следующая точка — ${n}`,
  pointRejected: (n: number): string => `Сначала точка ${n}`,
  focusAndContinue: (goal: string): string => `${goal}. Продолжай с конца линии`,
  hintAria: (n: number): string => `Подсказка, осталось ${n}`,
  boardAria: (n: number, count: number, total: number, rules: string): string => `Задача ${n}. Заполнено ${count} из ${total}. ${rules ? rules + '. ' : ''}Стрелки — движение и откат.`,
  giftProgress: (n: number): string => `Подарок: ${n} из 20`,
  deadEndReturn: (n: number): string => `Этот маршрут зашёл в тупик. Вернуться на ${n} ${noun(n, 'клетку', 'клетки', 'клеток')}?`,
  currentLevel: (label: string): string => `Уровень ${label}`,
  lastResult: (label: string): string => `Последний результат · ${label}`,
  setProgress: (n: number, total: number): string => `${n} из ${total} пройдено`,
  levelTile: (n: number, state: 'completed' | 'available' | 'locked'): string => `Уровень ${n}, ${state === 'completed' ? 'пройден, три звезды' : state === 'available' ? 'доступен' : 'закрыт'}`,
  wheelAria: (amounts: string): string => `Восемь равных секторов: ${amounts}`,
  wheelWin: (n: number): string => `Выигрыш: +${n} ${noun(n, 'монета', 'монеты', 'монет')}`,
  nextSpin: (time: string): string => `До новой попытки: ${time}`,
  themeNames: { classic: 'Классика', mint: 'Мята', lagoon: 'Лагуна', sunset: 'Закат', lavender: 'Лаванда', honey: 'Мёд', dusk: 'Сумерки', neon: 'Неон' },
  setNames: { intro: 'Первые линии', turns: 'Повороты', shapes: 'Сложные фигуры' },
  setDescriptions: { intro: 'Финиш, стенки и порядок точек', turns: 'Новые фигуры и сочетания правил', shapes: 'Большие поля и маршруты с ограничениями' },
  chapters: { finish: 'Финиш', walls: 'Стенки', checkpoints: 'Порядок точек', newShapes: 'Новые фигуры', preciseFinish: 'Точный финиш', detours: 'Обходы', finishWalls: 'Финиш и стенки', pointsWalls: 'Точки и стенки', branches: 'Развилки', longDetour: 'Дальний обход', pointsFinish: 'Точки и финиш', toFinish: 'Путь к финишу', routeOrder: 'Порядок обхода', allRules: 'Все правила вместе' },
};
export type Messages = typeof ru;
const en: Messages = {
  rewardRecoveryFailed: 'Could not check the ad reward. Please try again.',
  hintShop: 'Hints', hintShopCaption: 'Reveal the next cells of your route', buyHintSingle: '1 hint · 60', buyHintPack: '3 hints · 150', adCoins: '+150 coins · video', adLoading: 'Loading video…', adUnavailable: 'Video is unavailable now. Try again later.', adGranted: '150 coins received', hintBought: 'Hints purchased', getCoins: 'GET COINS',

  previewActive: 'TRYING', rareTheme: 'THEME', rareChance: 'A new theme — 1 in 8 chance', allThemesWheel: 'All themes collected — theme sector pays 300 coins', themeWon: (name: string): string => `Theme unlocked: ${name}`, giftMilestone: (n: number): string => `For ${n} completed puzzles`,
  resetShort: 'Reset', anotherTheme: 'Another theme', previewFree: 'Free preview', chooseTheme: 'CHOOSE', tryTheme: 'TRY', themePrice: (n: number): string => `${n} coins`,
  loading: 'Loading…', themes: 'Themes', home: 'Main menu', restart: 'Start over', hint: 'Hint', pause: 'Pause',
  won: 'CLEAR!', threeStars: 'Three stars', board: 'Board', navigation: 'Navigation', daily: 'Daily reward', settings: 'Settings', back: 'Back',
  resume: 'RESUME', done: 'DONE', levelSelection: 'CHOOSE LEVEL', homeCaps: 'MAIN MENU', themesCaps: 'THEMES',
  closePurchase: 'Close purchase', multiply: 'COLLECT ×5', openVideo: 'UNLOCK WITH VIDEO', videoUnavailable: 'Video is not available yet',
  level: 'Level', alreadyCompleted: 'Already completed', toLevels: 'CHOOSE LEVEL', next: 'NEXT', notNow: 'NOT NOW',
  gift: 'A gift!', newTheme: 'New theme', giftReward: '+100 coins for 20 new puzzles', coinPurchase: 'Buy with game coins',
  search: 'Finding a way…', searchAria: 'Finding a way', pointsDone: 'Numbers done — fill every cell', finishMarker: 'Empty diamond — finish',
  avoidWalls: 'Go around walls', finishLast: 'Reach the finish after every cell', start: 'Start at the light diamond', continueHead: 'Swipe in the direction you want',
  wallRejected: 'There is a wall — go around it', fill: 'Fill every cell with one line', releaseTip: 'You can lift your finger and continue',
  resumeTip: 'Continue from the end of the line', undoStart: 'Draw a line. Trace it back to undo', undoTip: 'Trace the line backwards to undo', undoDone: 'Undo is free. Fill every cell',
  hintShown: 'The pale line shows the way forward.', noHints: 'No hints left. Trace the line back or start over.',
  deadEnd: 'This route is a dead end. Try tracing back a few cells.', unknown: 'Could not find a way right now. No hint was used.',
  return: 'Go back', saveFailed: 'Could not save your progress.', retry: 'Retry', reload: 'Reload', needReload: 'Reload your saved progress to continue.',
  conflict: 'Your progress changed in another tab. Reload to continue.', slowStart: 'Loading is taking too long. Restart the app.',
  failedStart: 'Could not start the game. Restart the app.', failedSave: 'Could not read your save. Your progress has not been reset.', tryAgain: 'Try again',
  openElsewhere: 'The game is already open in another tab. Close it and try again.', language: 'Language', languageUnsaved: 'Language changed, but the choice could not be saved.',
  logoFirst: 'One', logoSecond: 'line', homeTagline: 'Fill every cell', chooseTask: 'Choose puzzle', chooseSet: 'Choose set',
  bankDone: 'All 90 puzzles completed', setDone: 'Set completed', result: 'Result', continue: 'Continue', play: 'Play', levels: 'Levels', appearance: 'Themes',
  dailyAvailable: 'A free spin is ready', dailyClaimed: 'Already claimed today', giftEntry: 'Gift: +100 coins', totalCompleted: 'Total completed',
  themeCaption: 'Two free themes; unlock the rest with coins', selected: 'Selected', apply: 'Apply', selectedAria: 'selected', applyAria: 'apply',
  sets: 'Sets', chooseSetCaption: 'Choose a puzzle set', bankCaption: '90 puzzles in three sets. New sets unlock after the first three puzzles.',
  bankDoneTitle: 'All 90 puzzles completed!', setDoneTitle: 'Set completed!', repeatAny: 'Replay any puzzle.', anotherSet: 'Choose another set or replay a puzzle.',
  rewardAlreadyReceived: 'The first-clear reward has already been collected.', previousFirst: 'Complete the previous puzzle to unlock the next one.',
  dailyCaption: 'One free spin every day', spinFree: 'Spin for free', spinVideo: 'Spin again with video', spinning: 'Spinning…', goodLuck: 'Good luck!',
  equalChance: 'Every sector has an equal chance', spinAvailable: 'A free spin is available', futureDate: 'A new spin will be available after the last claimed date',
  coins: (n: number): string => `${n} ${n === 1 ? 'coin' : 'coins'}`,
  balance: (n: number): string => `Balance: ${n} ${n === 1 ? 'coin' : 'coins'}`,
  buyFor: (n: number): string => `BUY FOR ${n}`,
  shortage: (n: number): string => `Not enough coins: ${n}.`,
  sound: (on: boolean): string => `Sound: ${on ? 'on' : 'off'}`,
  vibration: (on: boolean): string => `Vibration: ${on ? 'on' : 'off'}`,
  nextPoint: (n: number): string => `Next number — ${n}`,
  pointRejected: (n: number): string => `Visit number ${n} first`,
  focusAndContinue: (goal: string): string => `${goal}. Continue from the end`,
  hintAria: (n: number): string => `Hint, ${n} left`,
  boardAria: (n: number, count: number, total: number, rules: string): string => `Puzzle ${n}. Filled ${count} of ${total}. ${rules ? rules + '. ' : ''}Arrow keys move and undo.`,
  giftProgress: (n: number): string => `Gift: ${n} of 20`,
  deadEndReturn: (n: number): string => `This route is a dead end. Go back ${n} ${n === 1 ? 'cell' : 'cells'}?`,
  currentLevel: (label: string): string => `Level ${label}`,
  lastResult: (label: string): string => `Last result · ${label}`,
  setProgress: (n: number, total: number): string => `${n} of ${total} completed`,
  levelTile: (n: number, state: 'completed' | 'available' | 'locked'): string => `Level ${n}, ${state === 'completed' ? 'completed, three stars' : state === 'available' ? 'available' : 'locked'}`,
  wheelAria: (amounts: string): string => `Eight equal sectors: ${amounts}`,
  wheelWin: (n: number): string => `You won: +${n} ${n === 1 ? 'coin' : 'coins'}`,
  nextSpin: (time: string): string => `Next free spin in ${time}`,
  themeNames: { classic: 'Classic', mint: 'Mint', lagoon: 'Lagoon', sunset: 'Sunset', lavender: 'Lavender', honey: 'Honey', dusk: 'Dusk', neon: 'Neon' },
  setNames: { intro: 'First lines', turns: 'Turns', shapes: 'Complex shapes' },
  setDescriptions: { intro: 'Finish cells, walls and numbered cells', turns: 'New shapes and rule combinations', shapes: 'Larger boards and constrained routes' },
  chapters: { finish: 'Finish', walls: 'Walls', checkpoints: 'Number order', newShapes: 'New shapes', preciseFinish: 'Exact finish', detours: 'Detours', finishWalls: 'Finish and walls', pointsWalls: 'Numbers and walls', branches: 'Branches', longDetour: 'Long detour', pointsFinish: 'Numbers and finish', toFinish: 'Reach the finish', routeOrder: 'Route order', allRules: 'All rules together' },
};
export const catalogs: Record<Language, Messages> = { ru, en };
export let language: Language = 'ru';
export let copy: Messages = ru;
export const isLanguage = (value: unknown): value is Language => value === 'ru' || value === 'en';
export function setLanguage(value: Language): void {
  language = value; copy = catalogs[value];
  if (typeof document !== 'undefined') document.documentElement.lang = value;
}
export function loadLanguage(storage: Pick<Storage, 'getItem'>): void {
  let value: unknown;
  try { value = storage.getItem(LANGUAGE_KEY); } catch { /* Noncritical preference; never touches the save. */ }
  setLanguage(isLanguage(value) ? value : 'ru');
}
export function chooseLanguage(value: Language, storage: Pick<Storage, 'setItem'>): boolean {
  setLanguage(value);
  try { storage.setItem(LANGUAGE_KEY, value); return true; } catch { return false; }
}
export function translateMarkup(root: HTMLElement): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const value = copy[node.dataset.i18n as keyof Messages];
    if (typeof value === 'string' && node.textContent !== value) node.textContent = value;
  }
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const value = copy[node.dataset.i18nAria as keyof Messages];
    if (typeof value === 'string') node.setAttribute('aria-label', value);
  }
}
export const themeName = (id: string): string => copy.themeNames[id as keyof Messages['themeNames']] ?? id;
