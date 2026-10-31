# Проверка оптимизации Road Lines

Runtime commits: rendering `a1efa0741462857e610438edca42d624c5ef1152`, итоговый save migration guard `0927d31142e05008b3f8e112d22eb73e175f22a1`.
База: audit commit `97bc0488e98527fdd77de226417fb8f27907f0b0`, runtime в нём совпадает с `30690b531dd54a3cd1e390957b530efa1d8b56e3`.

## Изменения

Вместо постоянной повторной обработки одного Graphics поле хранит два текущих RenderTexture. Основа обновляется при изменении поля/темы/геометрии; маршрут — при изменении пути/подсказки. Пульс, искры, отказ и подсветка продолжения остаются небольшими живыми слоями. Когда они заканчиваются, Phaser останавливает цикл после финального paint. Следующее изменение состояния планирует одно пробуждение. Во время победы двигаются готовые текстуры; конечная миниатюра запекается заново.

Скрытый результат и фоновое приложение приостанавливают CSS timelines. Document/native background учитываются независимо от modal. Dispose запрашивает реальный последний шаг Phaser даже при sleep и освобождает владельца сохранения по destroy; остановленный экран также приостанавливает CSS.

Ограниченные пулы повторно используют до 360 объектов конфетти и 36 искр. Геометрия звезды и постоянные тригонометрические компоненты лент предвычислены. Количество частиц, цвет и длительность прежние. Раскладка хранит только последний viewport state потребителя; hit rectangles используют WeakMap. Идентичный обычный prefix не переписывает уже канонический snapshot, сохраняя проверки conflict/recovery; первая запись и миграция выполняются. Награды и транзакции не объединяются.

## Методика и границы

Headless Chromium, ANGLE SwiftShader, 390×844 CSS px, DPR 2. Изолированные production source copies добавляют только private `__perf` exposure для измерений; обычная сборка его не содержит. До/после выполняются последовательно. Одинаковый `shapes-29`, prefix 20, затем откат до prefix 11 и возврат к 20 через реальный pointer input. Один разогрев и три измеряемых повтора. Счётчик общего FillPath render node включает запекание кеша и живые эффекты.

`renderer.render` измеряет только финальную отрисовку сцены: новые запекания происходят в update. Его время нельзя трактовать как полное время кадра или ускорение всей игры. Allocation sampling включает собранные GC объекты: это временные выделения, не retained RAM. Программный GPU и CPU throttling не доказывают FPS/нагрев/потребление батареи на Android.

Основной 102-cycle soak и supplement измерены до последней строки, приостанавливающей CSS на dispose: source SHA-256 `a948858fc02e689883ef90986528a0d622517abcf76dde89628972374882673a`. Промежуточный runtime с этой строкой имеет source SHA-256 `56257cd148de846eb5ef3794d2b4adc3d4d05275a2959a742bf9c2dbdcda52f3`. Финальный runtime дополнительно сохраняет первоначальную миграцию перед no-op оптимизацией; source SHA-256 `2db00c7c214b6a475dd3709f977e74e5e73b0d0249841360bd7ecd624829ee79`. Первую миграцию проверяет отдельный тест, полный production smoke и повторный inspect theme/reward tail. Active dispose проверяется в отдельной regression-проверке: старый audit label «dispose-while-running» после оптимизации фактически открывает уже спящую игру. Финальная отдельная regression-проверка повторяет active/idle dispose.

## Измеренные результаты

| Проверка | До | После |
|---|---:|---:|
| Сложный prefix в покое | 377 FillPath на кадр | 0 кадров / 0 FillPath |
| Одинаковый drag, три повтора после прогрева | 22 270–23 024 FillPath | 4 707–4 791 FillPath |
| Временные sampled allocations, 2,4 с покоя, финальный парный прогон | 228 921 132 bytes | 0 sampled bytes |
| 8 pause/resume с одинаковым prefix | 8 одинаковых записей | 0 записей |
| Dispose спящего Phaser | pendingDestroy; canvas и GL живы | destroy завершён; canvas/texture/RAF/interval = 0 |
| CSS скрытого результата | 11 running timelines | paused; видимый ambient другого экрана остаётся |
| CSS в фоне | оставались running timelines | 0 running timelines |

Снижение числа FillPath для измеряемого жеста — примерно 79%. Нулевой allocation sample в покое означает отсутствие попаданий в семплер, а не доказательство математически нулевых выделений во всём браузере.

Пульс/искры отдельно проверяются без перестройки ни основы, ни маршрута. Конфетти остаётся ограниченным 360 объектами; новые пулы не меняют расписание трёх burst.

## Память и ресурсы

102 UI win/home cycles, затем 20 component FX start/collect/stop cycles. После GC:
- 6-cycle warmup: 5 912 148 bytes JS heap.
- 90 cycles: 6 737 132 bytes; 102 cycles: 6 739 680 bytes. Последние 12 циклов: +2 548 bytes.
- После 20 FX cycles: 6 777 948 bytes.
- DOM: 415 nodes, 65 listeners, 1 document во всех контрольных точках. Очереди particles/sparks/coins/timers/animations очищаются до 0.
- 20 worker requests: 10 FOUND + 10 cancellations; 0 активных workers после завершения.
- 30 paused viewport resizes: live WebGL textures 14, buffers 9, framebuffers 2, renderbuffers 2, programs 4, shaders 8; значения постоянны после прогрева. Старые framebuffer/renderbuffer удаляются.

Кеш добавляет два текущих RenderTexture и фиксированные WebGL ресурсы: в исходном аудите было 10 live texture handles, теперь 14. Текстуры обрезаны по границам фигуры; supersampling маршрута до 1.5× ограничен примерно 1.5M pixels. Это не оценка полной GPU памяти устройства. Unbounded cache уровней или размеров отсутствует.

В проверенных сценариях рост очередей, DOM, listeners и live GL handles не обнаружен; поздний JS heap вышел на плато. Это ограниченный soak, а не гарантия отсутствия любых утечек при всех будущих сценариях.

## Внешний вид

Парный static board screenshot: среднее абсолютное отличие RGB = 0.144/255. Проверены сложный путь, точки, стены, start/finish, тени, градиенты, конечная миниатюра и 10 сочетаний темы/viewport из UX smoke. Небольшие отличия сглаживания ожидаемы при offscreen rasterization; маршрут supersampled. Во время победного перемещения пунктир масштабируется вместе с кешем; в конечной миниатюре запекается с прежним финальным шагом. Количество эффектов не сокращалось.

## Проверки

- `npm run check`: 355 tests / 58 files, manifest, content validation и typecheck — PASS.
- Полный inspect-прогон на финальном runtime: CI step `npm run test:browser` в run `41217908083` — SUCCESS. Локально также повторены inspect themes/rewards после migration guard — PASS.
- `node tools/browser-smoke.mjs --production`: все 90 pointer solutions, три окончания наборов, пять viewport, live resize, touch cancellation/second pointer, workers, menus, themes, rewards/recovery — PASS.
- `node tools/ux-smoke.mjs --run`: 10 flow groups, 10 viewport/theme combinations — PASS на финальном runtime.
- `node tools/performance-regression.mjs --before ...`: парное сравнение + 6 assertions по idle/FX/CSS/active и sleeping dispose — PASS, page errors отсутствуют.
- `npm run android:sync`: PASS.
- Android debug CI `41217908074` на `0927d311...`: SUCCESS. App CI `41217908083` на момент фиксации evidence ещё выполняется; локальная production регрессия выше завершена полностью.
- Production bundle `index-CcPWRSxK.js`: SHA-256 `6cab4b6ace124fe52df16d24f3558d9cea855302839c14f70bcb86cde6c9de8b`. Private `__perf` в normal dist отсутствует.

Сырые агрегаты, snapshots после GC, primary/повторные paired measurements, provenance и границы команд — `PERFORMANCE_OPTIMIZATION_EVIDENCE.json`. Нормальная production запись показывает реальное прохождение shapes-29, победу и открытие shapes-30; GIF 320×693, 12 fps, 15.16 s — это демонстрация, а не измерение частоты кадров устройства.

## Воспроизведение

```sh
npm run check
node tools/performance-audit.mjs --long-soak
node tools/performance-audit.mjs --supplement
node tools/performance-audit.mjs --prepare-only
node tools/performance-regression.mjs
npm run test:browser
node tools/browser-smoke.mjs --production
node tools/ux-smoke.mjs --run
npm run android:sync
```

Для парного сравнения: в отдельном checkout исходного audit commit запустить `--prepare-only`, сохранить весь `.test-output/performance-audit/probe-src` вместе с его `dist` отдельно. Затем подготовить probe текущего кода и запустить `node tools/performance-regression.mjs --before /absolute/path/to/baseline-probe`. Зависимости baseline checkout должны оставаться доступны его symlinks. Не перезаписывать baseline новым probe. В baseline старого harness опции `--prepare-only` ещё нет: перенести только актуальный harness, не runtime, либо остановить его после подготовки probe.

Native Android: быстрый палец, haptics/audio, FPS/RSS/GPU memory/нагрев и process-death остаются для физической приёмки. Реклама отложена.
