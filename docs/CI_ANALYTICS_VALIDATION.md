# CI и аналитика — 1 ноября 2026

Runtime и tools: `03562ee6c0a169c9c648faf0e325e723af31cbcd`. База до прохода: `3edec631aa358b1cf25159a07c48328825c89045`.

## Что исправлено

1. CI разделён на полный kit/app regression job и независимые mobile-flow jobs: persistence, localization, analytics, reload-touch. Failure одного больше не скрывает другие результаты. JSON evidence и failure screenshot сохраняются artifact даже при падении.
2. Прежний persistence CI проходил 16 обычных сценариев, затем зависал в ожидании намеренного crash event на Ubuntu 24.04. Переключение на полный Chromium и `ulimit -c 0` проблему не устранили. В собственном upstream Playwright [crash test](https://github.com/microsoft/playwright/blob/main/tests/library/page-event-crash.spec.ts) явно пропускается на Ubuntu 24.04 с причиной «never dispatches the crash event». Только persistence job перенесён на Ubuntu 22.04. Оба настоящих crash scenarios сохранены, не подменены reload/skip. На Ubuntu 22.04 job прошёл.
3. Локализация периодически оставалась на home после единственного `.tap()` сразу после reload, при `ready=true`, законном сохранении результата и `blocked=false`. Получен настоящий CI failure screenshot/state из run `41313084161`, artifact `13085787350`. Старый ready ставился в той же RAF callback, где удалялся перекрывающий startup слой: это означало DOM mutation, а не уже открытый paint. Теперь startup снимается, затем ready/timeline/app_ready публикуются после следующей пары RAF. Dispose отменяет эти callbacks прежними двумя frame handles. Ошибка не маскируется повторным нажатием, arbitrary sleep, force-click или увеличением timeout. Native routing остаётся прежним.
4. Добавлен production immediate-reload touch regression: 15 reload/tap на каждую пару CPU1/4 × RU/EN = 60, mobile 360×800/DPR2. Тап один; проверяется реальный переход в game; при сбое сохраняются последние native touch/mouse/click события и screenshot. В localization failure тоже пишется touch trace.
5. Добавлены typed события и необязательный нативный AppMetrica transport; контракт, метрики и настройка — `ANALYTICS.md`. Правила/90 задач/экономика/save schema/визуальный дизайн не менялись.

Связь редкого CI tap-сбоя с compositor/readiness — вывод по сохранённому состоянию и порядку RAF; до исправления искусственный локальный reload corpus не воспроизводил потерю. Поэтому evidence отдельно хранит наблюдение, обоснование изменения readiness и результаты после него, а не выдуманный локальный failing reproduction.

## Локальные результаты финального source

- `npm run check`: 396 tests / 61 files; manifest/content validator/TS — PASS.
- `node tools/analytics-smoke.mjs`: 10 groups — PASS, внешних запросов нет.
- `node tools/localization-smoke.mjs --run`: 10 viewport/language combinations + 24 flows — PASS.
- `node tools/reload-touch-smoke.mjs`: 60 immediate taps/reloads при CPU1/4 — PASS.
- `node tools/performance-audit.mjs --prepare-only` + `node tools/performance-regression.mjs`: 6 assertions — PASS. Private probe не попадает в normal dist; normal analytics diagnostic marker исключён из production.
- Повторный final-source `performance-audit --long-soak`, `--supplement`, `verify-soak`: PASS — 102 UI cycles, 20 FX cycles, 20 worker requests и 30 paused resizes. DOM 432 / listeners 66 стабильны, post-warmup heap bounded; точные snapshots/budgets в evidence. Web no-op transport, не native SDK performance acceptance.
- `npm run android:sync`: PASS, повторный sync не дублирует Gradle/Application; отсутствие API key сообщается как disabled.

## CI финального commit

App workflow `41313807191` — **SUCCESS**, завершён 1 ноября 2026, 19:15 по Екатеринбургу. Все пять jobs: kit-baseline, persistence, localization, analytics, reload-touch — SUCCESS. Kit-baseline прошёл unit/manifest/content/TS, inspect всех 90, production всех 90, UX и balance. Mobile flows сохранили реальные crash и single-tap assertions.

Android workflow `41313807158` — **SUCCESS** на том же `03562ee6...`, включая Java/Gradle AppMetrica/plugin/Application. Финальный debug APK `road-lines-03562ee-debug.apk`: 5 823 109 bytes, SHA-256 `da347ac94d798e686925a8a9f5fe77a8b190f3017ddf22045ca4986369d694a2`. Outer artifact digest проверен; APK ZIP CRC проверен; встроенный JS `index-BJKdtrct.js` совпадает с локальным production bundle побайтно, SHA-256 `f5f5d9716d25e16e015b348f0e50fff0b5a7927077d3d5d456e05d5be7a860d6`. Ключ в APK отсутствует, SDK не активирован.

Точные jobs/steps/status, source hash и APK provenance сохранены в `CI_ANALYTICS_EVIDENCE.json`.

## Границы

Реальные events в кабинете AppMetrica ещё не подтверждены. Нужны debug API key соответствующего проекта и device/dashboard acceptance. Обычный web — no-op transport. Debug без ключа работает с отключённым SDK; это не live analytics acceptance.

Физический Android (палец, native sound/haptics/FPS/нагрев/process death), signed release и публикация остаются открыты. Реклама отложена. Новая native analytics integration означает новый APK; старый APK остаётся визуальным игровым build до аналитического прохода.
