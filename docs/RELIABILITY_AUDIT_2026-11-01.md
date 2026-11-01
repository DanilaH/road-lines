# Сохранения и длительный прогон — 1 ноября 2026

Проверен runtime `dc2d304895fd753545d79e363be209dd0379b5e0`, тот же, что в последнем debug APK. Baseline checkout `cfced4db8adc7de2ed012afcc6ad53b3049237bf`; новые тесты и диагностика — `f512ac4bbcf82cd5a6424d2f46095c5af082e0d7`. Игровой код, схема/ключ сохранения, экономика, уровни и визуал не изменены. В проверенных сценариях продуктовых ошибок, требующих исправления, не воспроизведено. Это ограниченный аудит, а не утверждение об отсутствии любых возможных ошибок.

## Сохранения

`npm run check`: 391 тест / 60 файлов, включая 27 новых fault tests; manifest, validator 90 уровней и TS — PASS.

Матрица: восемь операций — first clear, двадцатое прохождение вместе с подарком, списание подсказки, покупка темы, stage/commit колеса, acknowledgement подарка, отказ от предложения. Для каждой проверены отказ до записи, запись с потерянным подтверждением, запись с потерянным подтверждением и недоступным readback. Проверяется целиком старый либо целиком новый durable snapshot; при неоднозначности дальнейшая mutation заблокирована до authoritative reload.

Отдельно: все 90 прохождений с чередованием этих сбоев/рестартов/повторов дают ровно 2200 монет и четыре подарочных milestone. Все восемь секторов колеса начисляются один раз после потерянного подтверждения. Устаревшие записи маршрута/подсказки/темы/колеса не перетирают награду другого writer.

`node tools/persistence-smoke.mjs`: 18 production UI scenarios — PASS:

- Перезагрузка после обычной и двадцатой победы через 0/80/400/1200 ms; валюта/прогресс/подарок сохраняются без дублей.
- Navigation инициируется непосредственно внутри успешной записи first clear, до завершения эффектов.
- Отказ записи или недоступный readback после записи победы; перезагрузка и повтор.
- Покупка темы при тех же отказах: ownership/equipment/кошелёк остаются одной операцией.
- Отмена поиска паузой до ответа worker не списывает подсказку; подтверждённое списание сохраняется через reload. Визуальная подсказка — session state, её повтор после restart не объявляется бесплатным.
- Второе окно при Web Locks не получает writer; после закрытия владельца и reload продолжает с актуальными данными.
- Без Web Locks проверен последовательный storage-event conflict. Это fallback guard, не атомарный cross-process CAS для одновременных неподдерживаемых writer.
- Два реальных `Page.crash`: до commit и после commit колеса. Новый renderer восстанавливает прежние id/sector, выдаёт приз один раз, повторная загрузка не повторяет grant. Это browser crash, не native Android process death.

## Ресурсы

Headless Chromium, SwiftShader, 390×844/DPR 2. Private production source copy лишь открывает существующие объекты для диагностики; normal release не содержит `__perf`. Часть процессов выполнялась параллельно: времена кадра из этих запусков не используются для заявления ускорения.

102 цикла «игра → победа → меню», затем 20 presentation start/collect/stop cycles:

- Во всех контрольных точках 1 document, 432 DOM nodes, 65 listeners; очереди effects/timers/animations/coins/sparks очищены.
- После GC heap: 6 010 692 → 6 863 324 bytes от 6-cycle warmup до 102 cycles. Последние 24 цикла: +79 020 bytes; после component FX — 6 873 316 bytes. Зафиксирован ограниченный рост, а не математически нулевые allocations.
- 20 worker requests: 10 FOUND / 10 cancellations, живых workers после завершения 0.
- Dispose освобождает canvas, RAF/timeouts/intervals/workers и все созданные AudioContext. Отдельный performance-regression реально проверяет active и sleeping renderer. Счётчик oscillator `ended` не обязан обнулиться событием после закрытия AudioContext; закрытый context не является активным голосом.

30 paused resizes: live GL handles стабильны — textures 14, buffers 9, framebuffers 2, renderbuffers 2, programs 4, shaders 8. Восемь pause/resume на неизменном prefix не создают дополнительных записей.

Дополнительный large-board soak использует `shapes-29`, prefix 20: 66 пар реальных pointer жестов назад/вперёд, включая 6 warmup; 22 смены viewport 320/390 и 11 возвратов через меню. Автоматические проверки требуют одинакового конечного prefix, сохранения кошелька/подсказок, стабильных listener/renderer counts, пустых очередей и позднего DOM plateau. Первичный строгий warmup DOM equality оказался слишком ранним: 433 → 435 nodes, далее 435. Budget допускает до четырёх начальных узлов, но требует отсутствия дальнейшего роста; поздний JS budget — 512 KiB за 20 циклов. Финальный повтор завершён PASS: 433 → 435 nodes, 64 listeners; последние 20 циклов heap +42,172 bytes. Итоговые snapshots — в evidence JSON.

`node tools/verify-soak.mjs`: PASS. Source hash сверяется с текущими src; budgets — 512 KiB за последние 24 UI cycles и 2 MiB после warmup. `node tools/performance-regression.mjs`: шесть assertions idle/FX/CSS/background/active и sleeping dispose — PASS. В покое нет Phaser frames/FillPath; pulse/sparks не перестраивают кеш поля.

## Регрессия и CI

Полная локальная локализация повторно прошла: 10 viewport/language combinations и 24 extra flows. Старый App CI `41300409654` завершился failure на `.next.tap()` после reload в localization smoke; inspect/production всех 90 уровней, unit, UX и balance в том run прошли. Причина единичного CI-сбоя не установлена и исправленной не объявляется. Добавлены failure screenshot/state и всегда сохраняемый CI artifact; новые persistence scenarios включены в App CI. Новый CI на test commit при фиксации отчёта ещё не принят.

Результаты и provenance — [RELIABILITY_AUDIT_EVIDENCE.json](RELIABILITY_AUDIT_EVIDENCE.json). Предыдущий APK содержит тот же runtime; новый APK ради тестовых файлов не требуется.

## Воспроизведение

```sh
npm run check
node tools/persistence-smoke.mjs
node tools/performance-audit.mjs --long-soak
node tools/performance-audit.mjs --supplement
node tools/verify-soak.mjs
node tools/performance-regression.mjs
node tools/large-board-soak.mjs
node tools/localization-smoke.mjs --run
```

Следующий незакрытый этап — физический Android: настоящий палец, звук/вибрация, FPS/нагрев/RSS и native process death. Браузерный soak этого не подтверждает. Реклама остаётся отложенной.
