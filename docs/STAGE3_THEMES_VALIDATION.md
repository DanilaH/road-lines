# Этап 3 — каталог и покупка тем

Дата: 2026-10-30. Темы — вторая часть этапа 3; gift grant, skin offer и daily wheel ещё предстоят.

## Реализовано
8 собственных палитр: Классика, Мята, Лагуна, Закат, Лаванда, Мёд, Сумерки, Неон. Первые две бесплатны, остальные по 500 игровых монет. Каталог в два столбца показывает фон/клетки/ленту/пунктир, название, выбранную/доступную/закрытую тему и цену. Никаких чужих ассетов и новых зависимостей.
Палитра общая для Phaser field и UI: фон, пустые клетки, лента, пунктир/старт/голова, текст, панели, кнопки и отметки выбора. Монеты и звёзды сохраняют золотой цвет, hint — свой жёлтый акцент, наборы — различительные цвета. Убраны старые дубли цветов из presentation config. Превью использует те же значения, что и renderer.
Каталог доступен из главного меню, паузы и результата. Возврат восстанавливает точный источник: игра остаётся в паузе, результат остаётся результатом. Маршрут, номер, подсказки и заработанная награда не теряются. При уходе из результата presentation завершается до durable balance; назад не запускается повторная награда.
Нажатие закрытой темы открывает превью/подтверждение с ценой и балансом. При нехватке монет покупка недоступна. Отмена/Back ничего не списывает. Купленную/бесплатную тему можно применять сколько угодно; выбранная помечена текстом и обводкой. Скролл каталога сохраняется при выборе, focus возвращается на карточку. В диалоге focus проходит только по доступным кнопкам.
На коротком экране домашний hero и отступы уменьшены, чтобы новая кнопка тем не вытесняла настройки. Длинный каталог прокручивается.

## Persistence/economy
Схема JSON повышена до v2, ключ оставлен прежним. v1 → v2 сохраняет wallet/progression/drafts, выдаёт две бесплатные темы и Классику как выбранную. В v2 отсутствующие/неизвестные/дублированные ownership-данные или выбранная неоткрытая тема — ошибка чтения, не reset или притворная legacy-миграция.
GameStore.selectTheme: проверить id/владение/баланс; атомарно сохранить coins + ownedThemes + themeId; применить только после подтверждённой записи. Повторное нажатие/повторное применение не списывает. Failed write не публикует новое владение/баланс; lost ack проверяется обратным чтением; неизвестный исход блокирует изменения до reload. Web Lock/raw baseline и текущий writer сохранены.
При открытии каталога обычный prefix flush завершён и timer снят; последующие path/hint/finish строятся от текущего store.state, а не от старого полного snapshot. Отдельная покупочная очередь или второй writer не добавлены.
Временный банк 15 задач даёт максимум 300 base coins. Цена 500 не снижена ради этого подэтапа: первая платная тема без бонусов достижима после 25 первых побед при расширении банка. Для проверки покупок browser tests подготавливают local save; в production нет кнопки выдачи валюты или query для баланса.

## Проверки
- npm run check: 131 tests, 21 файл (97 kit + 34 application), typecheck, kit hashes, независимая проверка 15 уровней.
- Unit: миграция, строгий v2 ownership, бесплатное применение, нехватка средств, одна атомарная покупка, повтор/reload, failed write/lost ack, stale writer, последующие autosave/first reward/repeat.
- npm run test:browser и node tools/browser-smoke.mjs --production: оба финальных прогона прошли. Новые сценарии: каталог на пяти viewport, scroll/цели/диалог, все 8 реальных палитр, точные Phaser pixels и background, покупки/двойной confirm/reload/повтор, недостаток средств, failed disk write/retry, возврат в home/pause/result, награда и переход после покупки.
- Сохраняются полные прежние input/worker/touch/background/ownership сценарии и все 15 решений.
- Screenshots снимаются из текущей игры в .test-output/themes-*, theme-dusk-play, theme-neon-play, theme-dusk-result.
- npm run android:sync: production web build + Capacitor generation/sync прошли. Android compilation и оба CI прошли; ссылки и хеш ниже.

## Ограничения
Не добавлены реальные ads, rewarded unlock темы, wheel и подарки. Полный этап 3 ещё не завершён. Native физический плейтест, системный font scale/insets и качество звука/вибрации не подтверждены браузером/компиляцией. Android APK — debug, не signed store release.


## CI и APK
Code commit: 9e303b4a34caa3ff6fa14844bfd43f9064b160b1.
App and kit checks: https://github.com/DanilaH/road-lines/actions/runs/41020851786 — success, job 123947587015. Clean npm ci, 131 tests, inspect и production browser flows прошли.
Android debug build: https://github.com/DanilaH/road-lines/actions/runs/41020851628 — success, job 123947586254. Clean npm ci, JDK 21/SDK 36, web build, sync и assembleDebug.
Артефакт road-lines-debug: https://github.com/DanilaH/road-lines/actions/runs/41020851628/artifacts/12961970220 . ZIP 4226519 bytes; sha256:5f4ba4062074c0a7263f7a8a894e87ff1bde7bdf4438acecad59fcc030fa7ef1. Это digest ZIP GitHub Actions, не хеш извлечённого APK.
