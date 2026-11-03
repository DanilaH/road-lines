# Статус Road Lines

Актуальный завершённый проход: CI и аналитика — `CI_ANALYTICS_VALIDATION.md` / `ANALYTICS.md`. Финальный runtime 03562ee, App/Android CI SUCCESS; live analytics ждёт debug API key и dashboard/device acceptance.


Обновлено: 2026-11-01.

Актуальный итог: банк 90 (3×30), базовый цикл, темы и колесо реализованы. Реклама отложена по просьбе пользователя. RU/EN и обучение реализованы; следом — физическая Android-приёмка и оставшиеся релизные проверки. Ниже сохранена история этапов; свежая проверка банка — BANK_VALIDATION.md.

## Готово
Этапы 0 и 1: Phaser/Vite/Capacitor, 15 задач, ввод/откат/worker hints, сохранения/first-clear. Их CI проверены ранее.
Этап 2 реализован: появление клеток и локальная реакция, импульс→миниатюра, живые буквы/звёзды/Continue, fullscreen confetti, coin transfer, gift progress, собственные звуковые cues и native vibration plugin. Sound/vibration settings раздельные.
Локально 114 tests, пять viewport, все 15 input-прохождений, cancellation/double-click/mute проверки пройдены. Итоговые App and kit checks и Android debug build прошли на 2dc955d8b9fd0d11c161a62469fabf7005ee02b8; см. STAGE2_VALIDATION.md.

## Сейчас
Этап 3, первая часть: главное меню, наборы, сетка 15 задач, последовательное открытие/звёзды/повторы, настройки из меню, Back и завершение набора реализованы. Маршруты начатых задач сохраняются отдельно; старое сохранение мигрирует без сброса кошелька. 120 unit tests, android:sync, inspect/production browser flows и оба CI прошли на code commit 4733ad7f95c60bff75c47605a23c84ce69db54cc. APK и результаты — STAGE3_NAVIGATION_VALIDATION.md.
Первая полноценная сборка для device playtest. Компиляция не доказывает силу вибрации/качество звука и ощущений; physical device acceptance ещё не пройден.

## Темы
Каталог 8 тем и покупка реализованы: 2 бесплатные, 6 по 500, общая палитра UI/Phaser, подтверждение и атомарное сохранение ownership/coins/themeId. Миграция v1→v2. 131 tests, inspect/production browser flows, android:sync и оба CI прошли на 9e303b4a34caa3ff6fa14844bfd43f9064b160b1. APK и evidence — STAGE3_THEMES_VALIDATION.md.

## Награды и колесо
Экраны и локальная логика этапа 3 реализованы: ежедневное колесо, durable pending/recovery, gift ledger и предложение темы. Схема v3. Свежий CI восстановленной версии прошёл: 145 tests, inspect/production flows и Android debug build на 7811ef94c4b49706d26cf2bd3093d2ad9b4201d1. APK/evidence — STAGE3_REWARDS_VALIDATION.md.
В текущем банке 15 задач, поэтому подарок за 20 первых прохождений пока недостижим. Реальные видеонаграды остаются этапом 4.

## Далее
4. Реальные Android banner/interstitial/rewarded + durable receipt journal/ack.
5. 90 отобранных задач, RU/EN, производительность, signed release acceptance.
6. Сверка с конкурентом; затем новые идеи.


## Визуальная полировка
По запросу пользователя реклама отложена; первый проход визуальных улучшений реализован поверх текущего игрового цикла. См. раздел 18 плана. Сборка/typecheck и локальные доступные 14 reward-тестов прошли. Inspect и production browser smoke прошли на пяти viewport, с live resize, всеми 15 задачами, навигацией, восемью темами и reward/recovery flows. Отдельно проверены reduced-motion и остановка ambient на паузе. Код: 328b54b120401b74120b469d5a062742c40ef3ed. CI npm run check прошёл; полные workflows и Android build на момент записи ещё выполняются: 41044753390 / 41044753446. Это не физическая Android-приёмка и не завершение оставшихся этапов.


## Объёмные наградные объекты
Сгенерированы и встроены собственные подарок и медальон: шкала подарка/окно подарка, вход в ежедневную награду и центр колеса. Три прозрачных WebP, всего 21 762 байта; 384/96/128 px. Текст и управление остаются DOM, награды не зависят от изображений. Prompt/provenance/размеры и ограничения — docs/REWARD_ART.md. Typecheck и inspect smoke прошли на пяти viewport/всех 15 задачах. Отдельно проверены decode картинок и неподвижный hub; большое gift-окно только presentation fixture, поскольку порог 20 пока недостижим. Production smoke также прошёл на пяти viewport/всех 15 задачах. Код: b20b70d7a33b54b5297722a7ca3a5c8acba65f22. Android debug build 41051284315 прошёл; App and kit checks 41051284113 ещё выполняется; физическое устройство не проверено.


## Новый интерфейс: меню и HUD
Первый цельный проход реализован: своя композиция меню, кнопка «Играть», отдельные уровни/оформление/daily, компактный HUD, типографика Nunito и молочно-фиолетовая классическая палитра. Обновлены общие материалы паузы/результата. npm run check: 145/22 tests; inspect и production smoke: пять viewport, 15 задач, темы/покупки/reward flows. Отдельно проверены кириллица, reduced motion, тёмная тема и шестизначный баланс на 320×568/390×844/576×1280. Реальные GIF меню→игра/пауза→победа записаны из production build. Android CI запускается с commit; физическая приёмка не выполнена. См. UI_REDESIGN.md. Полная переработка колеса и остальных экранов не заявлена завершённой.

## Материал поля и переходы
Реализован следующий UI-проход: углублённые пустые клетки, тонкая глубина/блик ленты, скругление только свободных углов, объёмный head. Добавлен независимый ScreenMotion для меню/игры/паузы, без ожидания анимаций игровым вводом и без CSS-перемещения поля. Typecheck/145 tests прошли. Inspect browser smoke прошёл на пяти viewport и всех 15 задачах, включая темы/покупки/reward flows. Production smoke также прошёл на пяти viewport и всех 15 задачах; переходы, темы и reward flows проверены. Код: d1134949f7aa196645bb68cbc35d8303a13326de. Android debug build прошёл. CI: 41076517662 / 41076517576. См. FIELD_MOTION.md; физическая производительность не подтверждена.

## Колесо, наборы, уровни и каталог
UI-проход реализован: настоящие mask thumbnails без решения, явные статусы уровня, объёмные наборы/карточки тем, обновлённое колесо с золотым ободом и выигравшим сектором. Новых уровней/награды/правил нет. 145 tests и inspect browser smoke на пяти viewport/всех 15 задачах прошли; покупки, Back, daily recovery сохранены. Production smoke также прошёл на пяти viewport и всех 15 задачах. Оба CI успешны на 2fb39b9d5d52cc8af7225b61d0debba810529f78: App and kit checks 41081633963, Android debug build 41081633863. После сборки debug APK — проверка на физическом телефоне. См. COLLECTION_UI.md.

## Первый набор: 30 задач и три механики
По разрешению пользователя после исследования реализованы финиш (16–20), стенки (21–25), упорядоченные точки (26–30). Последние две задачи знакомят с сочетаниями. Исходные 15 задач/IDs/versions сохранены, целевой банк всё ещё 90. Модель, ввод, solver/hints и restore проверяют одни правила. Номера/финиш/стенки отображаются на поле и миниатюрах, в сетке есть подписи глав. Теперь подарок за 20 достижим обычным прохождением.
152 tests в 23 файлах, независимый аудит 30 раскладок/всех witnesses и влияния правил прошли. Inspect browser smoke прошёл на пяти viewport: все 30 задач реальным вводом, подарок/offer/финал, откат/запреты/worker hints/restore и тёмные темы. Production browser smoke также прошёл на пяти viewport/всех 30 задачах и новых механиках; android:sync прошёл с production assets. Оба CI успешны на 7f665b325177aeab754aa9986e7d6502324953ff: App and kit checks 41092052174, Android debug build 41092052084. APK/evidence — MECHANICS_VALIDATION.md. Правила и границы исследования — MECHANICS.md. Реклама отложена; физическая Android-приёмка, оставшиеся 60 задач, RU/EN и signed release остаются впереди.

## Полный банк 90 — 31 октября 2026
Банк расширен до трёх наборов по 30: первые 30 записей сохранены, добавлено 60 уникальных силуэтов со стенками/финишем/номерами и сочетаниями. Все наборы открываются после трёх tutorial, внутри — последовательный доступ. Выбор, счётчики, HUD и конец набора учитывают его границы; после всех 90 — явный финал. Черновики, кошелёк и глобальные подарки сохраняются между наборами, save v3 не менялся.
156 tests прошли; независимый аудит проверил все 90 witnesses, симметрии и вклад каждого нового правила. Детерминированное офлайн-авторство воспроизводится. В inspect build все 90 задач прошли реальным pointer input, включая три финала, четыре подарка, 2200 монет и повтор без награды. Production прогнал все 90 pointer solutions; отдельно исправлено место под комбинированные подписи и повторно проверены bank/mechanics flows на пяти viewport. Все 60 новых полей просмотрены в renderer. Итоговый код 525d6e5f7a5a62fa2ec83a007bf1c9148184bcb7; Android debug CI 41115073801 успешен. App CI 41115073971 также успешен: итоговый коммит прошёл inspect и production, все 90 pointer solutions и bank/mechanics/menu/theme/reward flows. APK/GIF/evidence — BANK_VALIDATION.md. Реклама, RU/EN и физическая Android-приёмка остаются следующими этапами.

## Новые обозначения маршрута
После замечания пользователя заменены стартовая стрелка и клетчатый флажок на светлый гранёный жетон и золотистое гнездо. Миниатюры и меню используют ту же форму; подсказка обновлена. 156 tests, production build и целевые bank/mechanics flows на пяти viewport/двух тёмных темах прошли. Правила и данные 90 задач прежние. См. ROUTE_MARKERS.md; физическая Android-приёмка не заявлена.

## UX и отклик после аудита — 31 октября 2026
Реализованы оба согласованных прохода: повтор текущей подсказки бесплатен; локальные сигналы стенки/раннего финиша/порядка; возобновление от головки; Continue без недоступных offer/x5 и повторного нажатия после gift; домашняя primary после конца набора; единые маркеры и Road Nunito; более ранний Continue и сокращённый добровольный сбор. Перерисовки Phaser объединены через dirty update, неизменные темы/DPR/стили номеров не обновляются на каждом ходе.
`npm run check`: 157 tests / 23 files; production UX smoke: 10 flow checks и 10 viewport/theme combinations, включая reduced motion, ack failure/reload, Back и двойное нажатие, прошли. Production-сборка прошла. Полный inspect/production прогон 90 задач и Android debug CI запускаются на code commit; результат здесь не предвосхищается. См. UX_POLISH_VALIDATION.md. Физическая Android-производительность, звук и вибрация не приняты; реклама по-прежнему отложена.

Дополнительно исправлены и проверены возобновление повтора в завершённом наборе и один repaint после resize спящего canvas на паузе. Production UX smoke: 10 групп сценариев / 10 сочетаний размера и темы. Все 90 pointer solutions прошли на первом UX code commit; последующий navigation regression выявлен и исправлен. Окончательные CI запускаются повторно; см. точные границы в UX_POLISH_VALIDATION.md.

Проверенный итог UX: code `7dc8b8b2c05f5c7f76ff0317ce067c86bde5d363`, 157 tests; 10 production UX groups / 10 viewport-theme combinations; inspect regression tail (touch/worker/menu/themes/rewards/recovery) прошёл. Финальный Android debug CI `41198023370` — SUCCESS. Полный App CI `41198023418` на момент записи выполняется; все 90 pointer solutions уже прошли на предыдущем UX code commit, а обнаруженный затем navigation regression исправлен и проверен. Точная граница evidence — UX_POLISH_VALIDATION.md.

## Независимый аудит производительности — 31 октября 2026
Проверен source `30690b531dd54a3cd1e390957b530efa1d8b56e3` без изменений игрового кода. Подтверждены повторная обработка/триангуляция неподвижного Graphics (377 FillPath/кадр на сложном префиксе) и крупный allocation churn; выявлены активные CSS timelines скрытого результата и незавершённый dispose при спящем Phaser. 38 UI cycles + 20 component FX cycles, отдельный 102-cycle soak, 20 worker requests, 30 WebGL resize cycles и ablations выполнены. DOM/listeners/worker/voice/texture-handle runaway в проверенных обычных сценариях не найден; slow JS heap growth после прогрева почти остановился.
Результаты, ограничения и порядок исправлений — PERFORMANCE_AUDIT_2026-10-31.md и соответствующий evidence JSON; воспроизводимый private-build harness — tools/performance-audit.mjs. На момент аудита оптимизация ещё не была реализована; последующая реализация и проверка описаны ниже. Android native FPS/RSS/GPU memory не измерены; реклама по-прежнему отложена.


## Оптимизация по результатам аудита — 31 октября 2026
Реализованы три прохода: два кешируемых слоя текущего поля + sleep в покое; корректный deferred destroy и остановка hidden/background CSS; ограниченные пулы частиц, предвычисление геометрии, кеш layout/hit rectangles и пропуск только идентичных канонических prefix snapshots. Первая запись/миграция и проверки конфликта сохранены; награды не объединяются.

Runtime: rendering `a1efa0741462857e610438edca42d624c5ef1152`, финальный migration guard `0927d31142e05008b3f8e112d22eb73e175f22a1`. В покое 0 Phaser frames / FillPath; одинаковый pointer drag после прогрева 22 270–23 024 → 4 707–4 791 FillPath (около −79%). Небольшой фиксированный набор RenderTexture/WebGL ресурсов заменяет постоянную триангуляцию.

102 UI cycles + 20 FX cycles: DOM/listeners стабильны, очереди очищаются, поздний heap выходит на плато (+2548 bytes за последние 12 UI cycles). 30 paused resizes: live GL handles стабильны. Final regression подтверждает отсутствие повторного bake при пульсе/искрах и завершение active/sleeping dispose.

Проверено: 355 tests / 58 files; final production smoke — все 90 pointer solutions, 5 viewport и полный flow tail; полный final inspect smoke в CI + локальный theme/reward tail; final UX — 10 групп / 10 viewport-theme combinations; Android sync. Android debug CI `41217908074` на финальном runtime — SUCCESS; App CI `41217908083` в момент записи выполняется. Это не native FPS/RSS/GPU memory acceptance.

Методика, обмен CPU на ограниченный кеш, точные границы source/evidence и результаты — PERFORMANCE_OPTIMIZATION_VALIDATION.md / PERFORMANCE_OPTIMIZATION_EVIDENCE.json. Внешний вид проверен парными screenshots и свежей production записью. Реклама остаётся отложенной. Следующий обязательный этап производительности — физический Android: палец, FPS/нагрев/память, audio/haptics и lifecycle/process death.


## Аудит банка и помощи — 1 ноября 2026
Независимый точный DP и отдельный перебор без отсечений совпали на всех 90 задачах. Решения есть у всех; точный графовый изоморфизм нашёл только осмысленную учебную пару 1–1 / 1–2. Просмотрены 90 renderer fixtures, проверены компоновки 390×844 и 320×568. Инструкции помещаются, минимальная клетка 52.13 / 41.70 CSS px.

587 различных префиксов × два CPU режима = 1174 worker requests: 0 oracle mismatches / UNKNOWN / отсутствующих ближайших откатов. Исправлены бесплатная диагностика тупика при hints=0 и сохранение подтверждённой подсказки/отката через паузу и фон. Исправлены формы «клетку/клетки/клеток» и оставшаяся глава про флажок. Данные/IDs/versions/порядок всех 90 уровней и экономика прежние.

Code: `fc7b1dab412b5ef4ff6aba90615fe682de0a3eb6` + `e43b837cfd3c9b6e31028befe1c6a9eada75f5de`. 355 tests / 58 files, 8 целевых UI checks, final UX 10 групп / 10 viewport-theme combinations и Android sync прошли. Полный production smoke всех 90 с 5 viewport прошёл на fc7b1dab до последнего lifecycle-help исправления; финальное изменение покрыто целевыми проверками. Android debug CI `41294119342` на финальном коде — SUCCESS; App CI `41294119322` выполняется. Новый corpus/zero-budget/lifecycle regression добавлен в App CI.

Кандидаты на редакторский просмотр ритма — 3–14 и 3–19 (большая доля вынужденных ходов перед более разветвлёнными задачами). Их сложность/интересность человеком не измерены; уровни не заменены на основании одних метрик. Отдельный риск обучения: первые tutorial можно пройти без упражнения reverse/release-resume. Подробности и bounded next pass — LEVEL_BALANCE_AUDIT_2026-11-01.md / LEVEL_BALANCE_AUDIT_EVIDENCE.json. Физический Android и RU/EN остаются открыты; реклама отложена.


## RU/EN и первые жесты — 1 ноября 2026
Реализован typed каталог всех UI/ARIA/error сообщений, названий тем/наборов/глав и числовых форм. Выбор RU/EN доступен в настройках дома и паузы, применяется без reload и сохраняется отдельно в noncritical key. Error/retry не затрагивает ценный GameSave; подтверждённая помощь переводится и остаётся применимой. Существующий self-hosted Nunito поддерживает обе письменности; dependencies/assets не добавлены.

Обучение 1–1/1–2/1–3 использует прежнюю строку инструкции: начало/fill, release/resume и reverse. Только session observation; никакого обязательного упражнения, popup, save field или нового gate. Модель, все 90 записей/версии/порядок, first-clear и экономика сохранены.

Runtime `dc2d304895fd753545d79e363be209dd0379b5e0`; test-only refinement `05278a714134231a90c18f62d33a4a93c95a4906`. 364 tests / 59 files; 10 viewport/language combinations и 24 extra flows прошли. Все 90 pointer solutions и five-viewport/mechanics/bank прошли; после обновления устаревшего focus assertion menu/theme/reward/UX tail повторно прошёл без runtime изменений. Legacy UX 10 групп / 10 viewport-theme, 1174 worker checks + 8 recovery UI checks, Android sync — PASS.

APK runtime build `41299441736` и повторный Android build `41300409695` — SUCCESS. APK 4 716 596 bytes, SHA f51550dd57e96598e30e6ae70fd5c32806d630aed1a210bb0db084d495301e6f; встроенный JS совпадает с проверенным production bundle. App CI `41300409654` в момент записи выполняется. Debug APK и production GIF подготовлены; это не физический плейтест или signed release.

Подробности, provenance и короткий список проверок телефона — LOCALIZATION_GESTURES_VALIDATION.md / LOCALIZATION_GESTURES_EVIDENCE.json. Открыты физический Android (палец/audio/haptics/FPS/нагрев/process death), аналитика и релизная приёмка; реклама по-прежнему отложена.

## Сохранения и длительный прогон — 1 ноября 2026
Runtime последнего APK сохранён без изменений. 391 unit tests / 60 files, включая 27 новых fault tests; 18 production UI scenarios с reload в разных фазах победы, отказами записи/readback, покупками, отменой hint, двумя окнами и двумя настоящими browser renderer crashes — PASS. На mixed faults/restores всех 90 clear получается ровно 2200 монет/4 gift milestone.

102 UI + 20 component FX cycles: 432 DOM nodes/65 listeners стабильны, очереди очищаются; heap после GC +79 020 bytes за последние 24 UI cycles. 20 worker requests очищены; 30 paused resizes не увеличивают live GL handles. Шесть performance regression assertions active/idle/background/dispose — PASS. Large-board pointer soak и его итоговые snapshots находятся в новом evidence. Это bounded browser evidence, не native FPS/RSS/thermal acceptance.

Полная локальная локализация повторно PASS: 10 viewport/language combinations +24 flows. Старый App CI `41300409654` упал на localization `.next.tap()` после reload, при прошедших inspect/production all90/UX/balance; причина единичного CI-сбоя пока не установлена. Добавлены failure screenshot/state и CI artifact, persistence smoke включён в CI. Новый test-only commit `f512ac4bbcf82cd5a6424d2f46095c5af082e0d7`: App `41309825959`, Android `41309825964` в момент записи выполняются. Не заявлять all-CI-green без результата.

Подробности: `RELIABILITY_AUDIT_2026-11-01.md` и `RELIABILITY_AUDIT_EVIDENCE.json`. Runtime/сохранения/экономика/90 уровней/визуал прежние; предыдущий APK актуален. Физический Android, аналитика, release acceptance открыты; реклама отложена.

## CI и аналитика — 1 ноября 2026
Финальный runtime `03562ee6c0a169c9c648faf0e325e723af31cbcd`. Добавлены typed события старта/первого хода/паузы/сброса/выхода/победы, outcomes подсказок, confirmed spend/purchase/wheel, save diagnostics и смены языка. Active time исключает blockers; restored result и redraw не повторяют победу. Web production — no-op; native AppMetrica SDK 8.5.1, Application/plugin и build-time configuration. Никакого изменения 90 уровней/экономики/save schema/визуального дизайна; реклама отложена.

Исправлена paint readiness после startup cover; отдельный production corpus проверил 60 immediate reload taps при CPU1/4/RU/EN. Crash CI перенесён на Ubuntu 22.04 по upstream ограничению отсутствующего Chromium crash event на 24.04, реальные crash assertions сохранены. Полный App CI `41313807191` на финальном runtime — SUCCESS: kit-baseline inspect/production всех 90, UX, balance и все четыре mobile-flow jobs. Android debug CI `41313807158` — SUCCESS.

Локально: 396 tests / 61 files, 10 analytics browser groups, localization 10 combinations +24 flows, 60 reload touches, 18 persistence scenarios и шесть performance assertions — PASS. Повторный 102 UI /20 FX/20 workers/30 resizes soak — PASS: DOM 432/listeners 66 стабильны, очереди очищаются; за последние 24 UI cycles heap +82 912 bytes, в пределах зафиксированного budget. Это browser evidence, не native SDK RAM/FPS/heat acceptance.

APK `road-lines-03562ee-debug.apk`, 5 823 109 bytes, SHA da347ac94d798e686925a8a9f5fe77a8b190f3017ddf22045ca4986369d694a2. Embedded JS совпадает с проверенным final production bundle. Debug key отсутствует: SDK activation/delivery не заявлены. Для живой debug проверки нужен GitHub secret `APPMETRICA_DEBUG_API_KEY` отдельного тестового проекта, затем проверка в AppMetrica и на устройстве. Signed release/публикация/физический Android остаются открытыми.

Контракт и настройка — `ANALYTICS.md`; результаты/provenance — `CI_ANALYTICS_VALIDATION.md` / `CI_ANALYTICS_EVIDENCE.json`.

## Семь правок физического плейтеста — 2 ноября 2026
Runtime `09c465c5cd7d4a19a56bb5f7bc1798ca56e7d81f`: оригинальные многослойные samples вместо runtime-осцилляторов, единый шаг пунктирного маршрута, относительное направление со свободного пространства с сохранением прямого drag, нижние reset/hint и надёжные touch-нажатия без дублирования. После победы — временная бесплатная примерка и явная покупка, при доступном Continue. Прямые переходы между наборами; last-number finish/version 2 только для первых трёх numbered lessons. Первые 15, IDs, экономика, заработанное и save schema v3 сохранены. Реклама отложена.
400 unit tests /62 files; 8 production touch/flow groups и 10 screen/theme combinations; 12 повторов быстрого swipe→dock→reset; мышь/клавиатура/cancel/drag-away — PASS. Android `41450046688` SUCCESS, встроенные JS/CSS/WAV побайтово совпадают с production dist. Все пять mobile jobs `41450046738` SUCCESS: persistence, localization, analytics, reload-touch, playtest. Полный CI baseline на момент записи ещё выполняется; отдельно зафиксирован локальный all90 production результат в evidence.
После 38 UI cycles DOM 473/listeners 71 стабильны; очереди/worker requests очищаются, dispose закрывает context и освобождает canvases/GL. Проверено ещё 20 FX cycles и шесть performance assertions. Это browser evidence, не доказательство отсутствия всех утечек и не phone FPS/heat. Debug analytics key отсутствует; native SDK delivery не заявлена.
APK — отдельный `Road Lines · тест`/`com.danilah.roadlines.playtest`, со своим сохранением: прежняя установленная игра и её прогресс остаются на месте. Явный debug key восстановлен из CI cache; релизная подпись/физическая приёмка остаются открытыми. Подробности и хэши — PLAYTEST_FIXES_2026-11-02.md / PLAYTEST_FIXES_EVIDENCE.json.

## Разнообразие звука, вибрации и наград — 2 ноября 2026
Runtime `eb4df929e51dcceee08a85ddebb65a5d419b8594`: 33 оригинальных offline clips /12 ударов клетки /3 тембра, фразы и ограниченный pitch/gain без соседних повторов; stronger native haptics с rate/priority guard. Result темы чередуются и показывают нехватку денег; примерка бесплатна. Редкая неполученная тема в одном из8 равных wheel sectors, fixed target до анимации, optional free Apply, fallback300 после сбора всех/получения duplicate. Старые денежные spins сохраняют суммы; GameSave v4 мигрирует v1–v3 с прежним key/заработанным. Новый полноэкранный GiftReveal раскрывает коробку, показывает награду и собирает presentation coins, без нового grant.
415 tests/63 files, расширенная fault matrix, production all90 pointer solutions/5 viewports/live resize плюс механики/меню/темы/rewards —PASS. По8 groups/10 combinations celebrations и playtest —PASS. CI все6 mobile jobs41466542171 SUCCESS; Android41466542320 SUCCESS. Полный kit-baseline этого же CI также SUCCESS: inspect/production all90, UX и balance. 38 UI/20 FX cycles и6 performance assertions —PASS: DOM477/listeners71 стабильны в UI cycles, queues/resources очищаются. Это bounded browser evidence, не phone FPS/feel.
APK6552253bytes, SHA `f135ab26f11b6308bd1c5538440c0c20488469ae8fdcc2834e9c8072808df9e1`. JS/CSS/WAV совпадают с production dist; manifest и cert совпадают с предыдущим `.playtest` APK. Сборка совместима с обновлением предыдущей тестовой установки. Ключ аналитики отсутствует, live delivery не заявляется. Реклама/покупка подсказок отложены по просьбе пользователя. Физическая оценка звука/силы мотора и release signing остаются отдельными. Подробности —REWARDS_FEEDBACK_2026-11-02.md / REWARDS_FEEDBACK_EVIDENCE.json.

## Исправление подарка по фидбеку — 2 ноября 2026
Runtime d555df4091c7dc528a0a89bb84bef9fafbe441a4: плоский SVG заменён реальными клипами принятого gift.webp (крышка/бант и передние наружные стенки). Исходный ассет неизменён. Новая reference-derived WebP-подложка12116bytes добавляет задние внутренние стенки/ободок/дно. Свет выходит из отверстия, фронтальные стенки его перекрывают;88 ярких частиц двумя выбросами, ленты/кружки, завершение за2.5с. Экономика/сохранение/правила не изменены.
415 tests/63 files PASS; celebrations8 groups/10 viewport-language combinations PASS, включая декодирование raster href, сворачивание при уже активном конфетти и нулевые particles/running animations после cancel. Шесть performance regressions PASS. Android41472749399 SUCCESS и все6 mobile jobs41472749353 SUCCESS; полный sequential baseline проверяется отдельно в evidence. APK6565155bytes SHA214c0d184efc42a3f388732f9d3de544683dff62ce7b1b5b57c87aa03fdd1180, все встроенные assets совпадают с production dist, manifest/signature прежние. Оригинальные пиксели и задняя стенка просмотрены в renderer и contact sheet раскрытия. Промпт/asset pipeline —REWARD_ART.md; provenance —GIFT_ART_FIX_EVIDENCE.json.

## Исследование монетизации — 2 ноября 2026
По запросу пользователя независимо пересмотрены пути монетизации до реализации: официальные карточки пяти коммерческих игр, локальный RuStore-аналог, контрольный близкий Fill, правила Яндекса и условия RuStore. Рекомендация-кандидат: редкие interstitial + единый rewarded-топап, banner отдельным экспериментом; не складывать автоматически x5/direct-theme/extra-wheel. Подсказки1/60,3/150 и топап150 — гипотеза, а не действующие цены. `research/MONETIZATION_REVIEW_2026-11-02.md` различает факты/исторические отзывы/выводы, оценивает платёжный путь, UX и ограничения90 задач. Пересчитываемая `tools/monetization-model.py` и JSON дают cashflow, цены, точное распределение free wheel и условные ad opportunities. Проверены бухгалтерские тождества/исходные константы и воспроизводимость расчёта. Runtime/save/native/dependencies без изменений; старый утверждённый контракт монетизации требует явного обновления перед внедрением. Доход/retention/живые показы не заявлены.


## Утверждение пакета монетизации — 2 ноября 2026
Пользователь согласовал итоговый пакет и попросил закрепить: `MONETIZATION_PLAN.md` — приоритетное ТЗ, AGENTS/решения/основной план ссылаются на него. Зафиксированы single60, pack3/150, rewarded150, banner, interstitial60с/5 впервые и90с/3 затем с общим fullscreen cooldown. Устаревшие источники и более редкая исследовательская частота явно исключены. Runtime/save/SDK не изменены, реализация и её проверки ожидаются.


## Пакет монетизации реализован — 2 ноября 2026
Runtime `87478e1109786e4beb7a565149de55a6eecda120`: native Yandex Mobile Ads8.6.0, AppMetrica8.6.0, GameSave v5 с миграциями v1–v4 и native earned journal/exact ack, покупки подсказок1/60 и3/150, единый topup150, active cadence60с/5 и90с/3, safe banner с фактическим SDK-размером/коротким fallback. Continue переживает закрытие рекламы в фоне и переходит ровно один раз; подарок защищён, фон внутри паузы отдельно синхронизирует banner. Portrait сохранён.
427 tests/64 files;13 monetization UI groups/10 language-viewport combinations; persistence18, celebrations8/10, analytics10, localization10+24, UX10/10 —PASS. Полный банк90 в production и inspection плюс resize —PASS;587 worker oracle jobs при CPU1×/4× и8 UI balance checks —PASS. Шесть renderer resource regressions —PASS; нового полного memory soak/physical FPS не заявлено.
Android41493029682 SUCCESS, все7 mobile jobs41493029706 SUCCESS; полный sequential CI baseline ещё выполнялся при записи. Старая проверка no-budget текста обновлена под утверждённый hint shop; новый harness проверен локально. APK10607495bytes SHA `b569b0e6b9013047d682d7ed558b6c8331a17deeaa1f5234f49cf39bb1d91ce8`, встроенные web assets совпадают с production dist; прежний signer, `.playtest`, portrait. APK с официальными demo-блоками, native/live/device/dashboard приёмка не подменена CI. Свои3 ID нужны для live-конфигурации. Реализация/ограничения —MONETIZATION_IMPLEMENTATION.md; подробные результаты/происхождение —MONETIZATION_EVIDENCE.json.


## Исправление блокировки запуска — 2 ноября 2026
Runtime `5b636c7e7cb506760bc27e9fd434f9dbb8c70227`: исходная цепочка ожидала native ad init/status до core platformReady. В ads-test до исправления воспроизведён15с startup warning при никогда не отвечающем status. Рекламный init/listener/status выведены из критического запуска, native RPC ограничены5с, первый render не усыпляется до готовности. Pending receipt остаётся защищённым; при зависшем pending отдельный retry, не очистка/угаданная награда.
427 tests/64 files;3 targeted startup cases,13 monetization groups/10 screen-language combinations и18 persistence cases —PASS. Android41499036810 SUCCESS, все8 mobile jobs41499036742 SUCCESS; полный sequential baseline ещё выполнялся при записи. APK10607751bytes SHA `4df705aeac2713e9c51b0654a6b14cc498b1a40487ef997e5b3ef4dda4d8b6dc`, web assets совпадают с production dist, прежняя подпись/portrait/package. Native причина отсутствия ответа на телефоне не установлена; исправленная цепочка проверена детерминированными browser faults, физический запуск отдельно. Подробности —STARTUP_ADS_FIX_2026-11-02.md / STARTUP_ADS_FIX_EVIDENCE.json.

## Убрана блокировка игры рекламной наградой — 3 ноября 2026
По физическому сообщению пользователя удалены ad-receipt/ad-recovery-error blockers, recoveryFailed guards на Play/Back/Continue/banner и обязательное окно ошибки рекламной награды. Pending/status/ack — фоновая работа с backoff и ограничением незавершённых RPC. Interstitial preload повторяется в фоне через30с, в том числе на длинном уровне. Валидный receipt синхронно settle актуальный prefix → atomic grant+ledger, без отмены жеста/solver; ack не держит fullscreen blocker. Отдельные storage conflict/ambiguous protections сохранены.
Проверено локально: npm run check —238 tests/31 files; отдельный vitest --root vendor/mini-games-kit —97 tests/17 files (итого335/48),5 новых service fault cases,18 persistence browser cases, startup4, monetization14 flow groups/10 viewport-language combinations, localization10+24, analytics10 и reload-touch4 —PASS. Android41595504126 —SUCCESS, все8 mobile flows41595504123 —SUCCESS (полный sequential baseline ещё выполняется). APK10607903bytes SHA `d1b65e26f315533bf690780b3a93489e897f831beadc68b3b74e91179019206d`;12 web files совпадают с production dist, прежние signer/package/portrait. Происхождение —AD_BACKGROUND_FIX_EVIDENCE.json. Физический телефон/живой SDK не заявлены подтверждёнными.

## Гармония и плотность звука — 3 ноября 2026
По жалобе пользователя убраны случайная расстройка, разные исходные высоты strikes, негармонические обертоны и несовместимые reward chords. Все cell samples —C5; дискретная фраза C/D/E/G, шаг<=3 полутона. Разнообразие —три мягких тембра/разный контакт, не случайная высота. Все UI/reward/coin в до мажоре, coin без непрерывного pitch sweep. Сэмплы короче и RMS-выровнены; route audio65мс/coin60мс, старый route хвост затухает20мс без очереди; сила/ритм haptics не изменены.
Локально npm run check239 tests/31 files —PASS; celebrations8 groups/10 language-viewport combinations —PASS. Новый audio-smoke на реальных WebAudio nodes:3 группы (быстрые forward/undo, mute/background/resume без replay, один context/dispose) —PASS. Waveform-аудит12 клеточных сэмплов: max tuning error0.464cent, RMS ratio1.00002, peak0.48, побайтовая воспроизводимость. Sprite499244bytes вместо721004. Добавлен audio CI flow. Субъективная оценка на динамике физического телефона остаётся за плейтестом.
