# RU/EN и обучение первым жестам

Дата: 1 ноября 2026. Runtime `dc2d304895fd753545d79e363be209dd0379b5e0`. Проверки и уточнение focus-cycle: `05278a714134231a90c18f62d33a4a93c95a4906`; runtime, стили и HTML между этими commits одинаковы.

## Результат

Добавлен живой переключатель Русский / English в настройках дома и паузы. Меняется весь текущий интерфейс, без reload и пересоздания Phaser: меню, наборы/главы, темы, покупки, поле, ошибки правил, подсказки/откат, победа, подарок и колесо, startup/recovery и ARIA. Уведомление с уже подтверждённым откатом переводится вместе с его кнопкой; помощь остаётся привязанной к прежнему prefix.

Типизированный каталог `src/i18n.ts` содержит строки, функции количества и имена themes/sets/chapters. Названия вынесены из игровых metadata, IDs/цвета/цены/границы наборов прежние. Новых зависимостей, шрифтов или внешних запросов нет. Существующий Road Nunito поддерживает обе письменности: cmap 660 entries, все ASCII 32–126 присутствуют.

Русский остаётся исходным языком для существующих пользователей. Явный выбор хранится отдельно в `road-lines.locale.v1`. GameSave v3, prefix, completed, coins, hints, theme ownership и daily ledger не переписываются из-за выбора языка. Недоступное/повреждённое preference даёт RU; отказ записи меняет язык в памяти и показывает предупреждение. Повторное нажатие выбранного языка позволяет сохранить его после восстановления записи. `html.lang` и доступные названия обновляются. Кнопки называются на своих языках и имеют `lang=ru/en`.

## Обучение

- 1–1: начало у ромба и заполнение поля.
- 1–2: сообщение о возможности отпустить палец; после завершения неполного жеста — продолжение с конца.
- 1–3: движение назад по линии; после фактического reverse через route input — подтверждение бесплатного отката.

Обучение занимает прежнюю строку инструкции. Окон, таймеров ожидания, обязательных упражнений, gates, новых наград или save fields нет. Состояние двух наблюдённых жестов session-only; меняется при реальном вводе, reset/кнопка отката не изображают освоение жеста. Пройденные уровни показывают обычную инструкцию. Цели механик имеют приоритет. Все уровни можно завершить без демонстрационного отката.

## Проверки

- Manifest/content/typecheck + 364 tests / 59 files — PASS. Проверены noncritical storage failures, сохранение valuable snapshot, invalid preference, живой binding/`html.lang`, RU/EN number forms, coverage известных themes/sets/chapters и pure coaching.
- Production localization smoke: 10 viewport/language combinations (320×568, 360×800, 390×844, 412×915, 576×1280 × RU/EN) — PASS.
- На каждой комбинации: home, settings, оба переключения, sets/grid, восемь themes, покупка, wheel до/после, gameplay, настоящая победа, reload/result/next. Game pause дополнительно проверяет, что язык доступен выше баннера. Видимые EN тексты и ARIA не содержат кириллицы, кроме намеренной кнопки «Русский».
- 24 дополнительных flows — PASS: actual touch release/resume/reverse в двух языках; free rollback/paid hint через смену языка; failed preference write + retry; owner-lock error; unreadable valuable save без reset; 16 rule cases на 320/390 и светлой/тёмной темах, включая длинную подпись после всех номеров и локальные отказы финиша/стенки/порядка. Длинные инструкции не пересекают баннер.
- Все 90 pointer solutions, три финала, пять viewport и touch/worker/mechanics/bank прошли. Старый menu assertion ожидал Tab без новых language controls; он обновлён до sound → vibration → RU → EN → resume, затем menu/theme/reward и прежний UX tail повторно прошли на том же runtime. Это честно зафиксированный split run; полные CI запускаются отдельно.
- Прежний UX smoke: 10 групп / 10 viewport-theme combinations — PASS.
- Worker regression: 587 corpus cases × normal/CPU×4, без oracle mismatches / UNKNOWN / пропущенных ближайших откатов; 8 recovery UI checks — PASS.
- Android sync — PASS. Android debug CI `41299441736` на runtime commit — SUCCESS; повторный `41300409695` на test commit — SUCCESS. App CI `41300409654` на момент фиксации выполняется, его завершение не предвосхищается.

Точные результаты — `LOCALIZATION_GESTURES_EVIDENCE.json`. Данные всех 90 puzzles/IDs/versions, wallet/rewards/экономика и рекламная отсрочка сохранены. Diagnostic `__perf` используется только private worker-regression build.

## Сборка для телефона

`road-lines-ru-en-dc2d304-debug.apk`, 4 716 596 bytes. SHA-256:

`f51550dd57e96598e30e6ae70fd5c32806d630aed1a210bb0db084d495301e6f`

Artifact `13080478159`, build `41299441736`, исходный commit dc2d304. SHA-256 ZIP совпал с GitHub artifact digest. CRC внутреннего APK проверен; `assets/public/assets/index-Djt_IT9_.js` побайтно совпадает с проверенным локальным production bundle. Это debug, не signed release и не опубликованная версия RuStore.

Production GIF показывает переключение EN, release/resume, reverse и возврат RU. 320×693, 12 fps, 12.91 s; это демонстрация, не измерение частоты кадров устройства.

### Короткая физическая проверка, когда появится возможность

1. Выбрать English, закрыть и снова открыть приложение; проверить язык, затем повторить с русским.
2. На 1–2 отпустить и продолжить; на 1–3 провести назад. На большом поле проверить быстрый палец и промахи.
3. Отдельно включить/выключить звук и вибрацию; проверить клетки, откат, победу и награды.
4. Свернуть во время маршрута/подсказки/победы, вернуться; затем проверить восстановление после убийства процесса. Prefix/coins/first-clear/daily result не должны теряться или повторно выдаваться.
5. Поиграть 5–10 минут на поздних полях: проверить плавность, нагрев и удобство попадания пальцем. Эмуляция и APK compilation этого не доказывают.

## Воспроизведение

```sh
npm run check
node tools/localization-smoke.mjs --run
node tools/browser-smoke.mjs --production
node tools/ux-smoke.mjs --run
node tools/balance-smoke.mjs
npm run android:sync
```

Localization smoke добавлен в App CI. `--rules-only` предназначен для повторения только rule-caption части после уже успешной матрицы на неизменном runtime; обычный запуск всегда проверяет всё с нуля.
