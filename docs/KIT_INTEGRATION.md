# Что переносим из mini-games-kit

Это карта применения, не отчёт о готовой интеграции. Snapshot лежит в vendor/mini-games-kit, provenance — в manifest.json.

| Механизм | Для чего в Road Lines | Где граница |
|---|---|---|
| GameplayActivityCoordinator | Общие блокировки ввода/звука: реклама, фон, пауза | Привязка Phaser/Capacitor остаётся локальной |
| Native banner placement | Корректное положение native view внутри зарезервированного места | SDK, DOM slot, измерение и поколения запросов надо подключить |
| JsonStorageRepository + StorageAdapter | Версии и упорядоченные записи сохранений | Codec, миграции и native storage не входят |
| RevisionSnapshotQueue | Частые полные снимки маршрута без очереди каждого движения | Не транзакции; один writer; исключить устаревшие producers |
| DurablePendingTransactionSession | Фиксированный выигрыш колеса, локальные staged операции | Наша схема, journal/commit, подтверждение durable truth |
| DurableReceiptQueue (Seeds branch) | Однократная выдача earned reward и точный native ack | Нативный журнал до JS, проверка target и durable ledger |
| ActionInterstitialGate | Ограничение частоты запросов | Сверху наши первые 5 побед, общий cooldown, защита праздников |
| Value transfer | Разлёт/прилёт монет и правильный конечный счётчик | Уже выданные значения; tween не владеет кошельком |
| PresentationSkipController | Быстрое продолжение без ожидания всех эффектов | Пропуск presentation не повторяет транзакцию |
| RandomSource | Тестируемый выбор сектора/эффектов | Результат колеса сохраняется до анимации |
| Pitch helpers | Ограниченный рост тона клеток/сбора | Наши тембры, громкость и лимит cue rate |
| PresentationAudioMixer | Безопасное mute/block/dispose, если понадобятся постоянные слои | Не требует вводить музыку/ambience ради самого модуля |
| Continuous interaction/noise | Опциональная нормализация непрерывного жеста | Не заменяет дискретный route input; шум не обязателен |
| Render density | Контроль canvas DPR и памяти | Числа проверяются на наших устройствах |
| Viewport watcher | Согласованная геометрия WebView и resize | Landscape helpers не использовать как product layout |
| Startup runtime | Измерение запуска, устойчивое отображение загрузки и диагностика | Готовность означает реально отображаемую игру; не фиктивные проценты |

## Практики, которые переносим как инструкции
- Детерминированный ремонт только transient/derived save-данных; не уничтожать весь прогресс.
- Процесс релизной Android-приёмки: signed/R8 payload отдельно от browser/mocks.
- RU/EN проверяются в реальном интерфейсе; скрины снимаются из текущей игры.
- Onboarding привязан к выполненным действиям, не к таймерам.
- Ассеты делятся на startup/session/deferred; не загружать каталог тем целиком ради первой клетки.
- Не копировать бюджеты памяти, DPI, частоту рекламы, редкости и экономику чужих игр.

## Чего в kit нет
Нативного Java/Kotlin/Capacitor SDK-моста, готовых haptics, Fill-модели, сегментного распознавания маршрута, solver, генератора/банка головоломок, звёзд/подарков, Phaser-конфетти и полного игрового UI.
Всё это нужно реализовать в Road Lines. README донора или наличие API не означает готовность этих частей.

## Проверки переноса
npm run check проверяет Git blob hashes/манифест, типы и перенесённые regression tests.
Исходные примеры в focused docs показывают upstream package import paths. В Road Lines импортировать конкретный локальный файл vendor/mini-games-kit/src/... либо явно заведённый project adapter.
Нельзя импортировать пакетные подмодули, которых snapshot не содержит.
