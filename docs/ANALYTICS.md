# Аналитика Road Lines

Реализация: runtime `03562ee6c0a169c9c648faf0e325e723af31cbcd`. `GameAnalytics` использует интерфейс `AnalyticsAdapter` из закреплённого kit, без изменения vendor. Android transport — собственный Capacitor plugin и официальный AppMetrica SDK 8.6.0 (актуальный native Gradle recipe). Обычная web-сборка ничего не отправляет; diagnostic sink доступен только в отдельном compile mode `analytics-test`, не через URL/storage/window.

## События и чтение отчётов

Все события содержат `schema=1`. Level metadata: `level_id`, `level_version`, `set_id`, количество клеток и признаки finish/walls/checkpoints. Маршруты, witness, полные snapshots, баланс кошелька, тексты исключений и произвольный пользовательский текст не передаются.

| Событие | Когда / важные параметры |
|---|---|
| `app_ready` | Один раз на запуск WebView после первого открытого paint, `language`. Не заменяет SDK sessions. |
| `startup_error` | Категория `ownership` либо `save_or_boot`, без error text/raw save. |
| `level_start` | Вход в незавершённую игру; `attempt`, `resumed`, `replay`. |
| `first_move` | Первый изменивший путь жест этой попытки; `active_ms`. Reset/предложенный rollback не имитируют жест. |
| `level_pause` | Общая блокировка игры; `active_ms`, `filled`. Несколько одновременных blockers не дублируют событие. |
| `level_reset` | Сброс, реально изменивший путь. |
| `level_complete` | После успешного durable finish; `active_ms`, `first_clear`, `reward`, `resets`, `undo_cells`. |
| `level_exit` | Выход незаконченной попытки; экран-назначение/selection/pagehide/dispose, `filled`, время и счётчики. |
| `hint_request` | Принятый новый запрос worker; повтор уже оплаченной помощи сюда не входит. |
| `hint_result` | `found`, `dead_end`, `unknown`, `cancelled`, `no_budget`, `save_failed`. |
| `hint_spent` | Только после подтверждённой записи списания; `remaining`. |
| `hint_repeat` | Бесплатный повтор сохранённой session-подсказки на том же prefix. |
| `theme_purchase` | После durable покупки; `theme`, `price`. |
| `theme_selected` | Реальная смена на уже принадлежащую тему. Нажатие текущей темы — no-op. |
| `wheel_reward` | После commit фиксированного результата; `sector`, `amount`, `recovered`. |
| `save_error` | Не более первого сообщения за запуск, `operation`; диагностика не превращается в поток ошибок. |
| `save_conflict` | Первое обнаружение внешнего writer, без contents. |
| `language_change` | Применённый язык и `saved` для noncritical preference. |

Попытка — посещение уровня, не пожизненная попытка решения. Выход в каталог/меню завершает её; возврат создаёт новую с `resumed=true`, если путь уже начат. `attempt` — локальный порядковый номер в текущем JS lifetime, не глобальный ID. Для retention/session использовать встроенные показатели SDK, для difficulty — сегменты по level ID, replay/resumed и first_clear.

`active_ms` исключает паузу/фон/прочие activity blockers. Решение, сделанное повторно, даёт `first_clear=false`, `reward=0`. `reward` — базовая first-clear награда, не сумма вместе с подарком и не revenue реальных денег. Восстановленный экран уже сохранённого результата не отправляет ещё один completion. Reload/context restart не повторяет уже завершённый wheel grant. Навигация после победы не добавляет ложный unfinished exit.

Непредвиденное убийство процесса может не дать `level_exit`: `level_pause` — последний наблюдённый checkpoint, не доказательство отказа игрока. Отменённый/неизвестный/неоплаченный hint не считать использованной платной помощью.

## Надёжность и цена

События не участвуют в транзакциях. Error/rejection analytics не отменяет сохранение, награду, ввод или старт игры. У `GameAnalytics` только одна текущая попытка и счётчики; нет таймеров, per-frame/per-cell событий, отдельного storage key или durable analytics outbox. На Android одновременно не более 32 ожидающих bridge calls, ошибки Promise перехватываются. При переполнении/offline/закрытии события могут потеряться. Это best-effort product analytics, не exactly-once бухгалтерия наград. Авторитетная экономика остаётся в GameStore.

SDK сам управляет своим буфером/сессиями. Приложение не форсирует сетевой flush на каждую клетку. Native initializes один раз в Application до bridge, не из отдельных экранов. В WebView не создаётся второй JS-счётчик.

## Настройка и границы готовности

`tools/android.mjs` детерминированно копирует plugin/Application/Gradle-файл и создаёт игнорируемый generated asset `android/app/src/main/assets/road-analytics.json`. Ключ читается из `APPMETRICA_API_KEY`, валидируется как UUID, не печатается в логе и не попадает в web bundle или исходники. Повторный sync сохраняет одну Gradle application и один Application в manifest.

Для GitHub debug APK workflow использует **`APPMETRICA_DEBUG_API_KEY`** secret и передаёт его генератору как `APPMETRICA_API_KEY`. Нужен отдельный тестовый проект AppMetrica, чтобы debug не загрязнял production. Отсутствие ключа явно отражается в build log как disabled; приложение работает, SDK не активируется. В repo нет подставного ключа или автоматической регистрации чужого проекта. Для будущей release-сборки использовать собственный production API key в build environment.

Включённые ограничения: location tracking и advertising identifiers tracking выключены; auto crash/native crash reporting выключены; опциональные modules identifiers/location/appsetid/ad-revenue/billing/screenshot/ndkcrashes исключены. Это не утверждение об отсутствии SDK installation/device/network metadata: при активации это нужно учитывать в описании обработки данных и декларациях RuStore. В монетизационном проходе2 ноября добавлен Yandex Mobile Ads8.6.0; при декларации данных учитывать оба SDK.

Native plugin `status()` сообщает, активирован ли SDK. Компиляция и mock/diagnostic events не доказывают доставку в AppMetrica. Для live acceptance после настройки ключа: установить соответствующий APK, пройти сценарии, проверить реальные events/params/session в кабинете, перезапустить и сверить отсутствие повторного первого clear и wheel reward. Пока это не сделано, dashboard delivery остаётся открытой.

## Проверки

- `npm run check`: 396 tests / 61 files, включая elapsed/дубли/undo-reset/выход/dispose/throwing sink и metadata contract.
- `node tools/analytics-smoke.mjs`: 10 browser groups — посещения/пауза/фон, first move/сброс, win/reload/двойной Continue, отмена/списание/повтор/failed write/no-budget/dead-end/UNKNOWN hint, новая и восстановленная wheel reward, purchase/owned selection/no-op, categorical startup error. События записаны диагностическим sink; внешних запросов нет.
- Полная локализация: 10 viewport/language combinations + 24 flows; 60 immediate reload taps при CPU1/4, RU/EN; performance regression шести idle/FX/CSS/dispose assertions; Android sync.
- Точная CI-приёмка и provenance — `CI_ANALYTICS_VALIDATION.md` / `CI_ANALYTICS_EVIDENCE.json`.

## Первичные источники

- [Official quick start](https://appmetrica.yandex.com/docs/en/sdk/android/analytics/quick-start).
- [Event reporting / configuration](https://appmetrica.yandex.com/docs/en/sdk/android/analytics/android-operations.html).
- [Config API pinned v8.5.1](https://github.com/appmetrica/appmetrica-sdk-android/blob/v8.5.1/analytics/src/main/java/io/appmetrica/analytics/AppMetricaConfig.java).
- [Official optional modules](https://github.com/appmetrica/appmetrica-sdk-android).
