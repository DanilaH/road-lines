# Реализация пакета монетизации — 2 ноября 2026

Продуктовый контракт: [MONETIZATION_PLAN.md](MONETIZATION_PLAN.md). Здесь описана реализация, а не подтверждение живой выручки или физического Android-плейтеста.

## Что подключено

- `src/core/monetization.ts`: одинарная подсказка60, пакет3/150, topup150, строгая схема receipt.
- `src/services/save.ts`: GameSave v5, миграция v1–v4 без изменения заработанного; покупка за монеты и кошелёк/receipt high-water mark в одном атомарном документе.
- `src/services/ad-cadence.ts`: отдельный неценный policy-документ `road-lines.ads.v1`, без копии кошелька. Монотонно накопленные активные миллисекунды;60с+5 первых побед, затем90с+3 новых. Офлайн/пауза/реклама не добавляют активное время. После оборванного fullscreen требуется новый интервал. Ошибка policy storage отключает принудительную рекламу, не сбрасывает ценные данные.
- `src/services/monetization.ts`: один fullscreen, общие blockers, последовательная receipt queue, recovery до игрового ввода. Предварительно загружается только interstitial; rewarded загружается после явного запроса.
- `native/android/RoadAdsPlugin.java`: настоящий Yandex SDK bridge, три формата, main-thread callbacks, native SharedPreferences receipt journal, exact ack, защита stale callbacks, pre-show deadlines, cleanup и backoff.
- `src/platform/banner.ts`: используется pinned `resolveNativeBannerPlacement`, реальная ширина/высота SDK view, WebView/root/safe-padding mapping; remeasure→reserve→place. Баннер ниже dock; короткий экран/модальные и праздничные сцены скрывают его. Размер не вычисляется по произвольной CSS-плотности.
- `src/main.ts`: покупки без автоматического расхода подсказки, одинаковый topup из помощи/тем, свободный выход, платный partial hint только при FOUND. На результате бесплатная примерка остаётся доступной; нехватка ведёт к явному пополнению.

## Ценная транзакция и восстановление

Native receipt: `schema=1`, `id=session UUID`, `stream=install UUID`, последовательный `sequence`, placement `hint-coins|theme-coins`, amount150. Rewarded amount из кабинета не переопределяет утверждённую игровую выплату. Только `onRewarded` создаёт receipt. SDK dismiss/load/impression не являются выдачей.

В Android stream/sequence/pending записываются одной синхронной `SharedPreferences.commit()` до уведомления JS. Одновременно допускается один pending; новый fullscreen не начинается до его обработки. Повтор SDK callback в сессии игнорируется. При ошибке диска тот же receipt сохраняется в памяти и повторяется с той же identity, JS не получает неподтверждённый native grant. Гибель процесса при физически недоступном диске не даёт гарантии записи: это не представляется решённой невозможной гарантией.

JS запрашивает pending в фоне без блокировки ввода. Только при получении валидного receipt синхронно сохраняет актуальный prefix и загружает авторитетный save; до завершения атомарной записи нет await и возможности вклинить другого JS producer. Все producers используют текущий GameStore.state, готовых устаревших полных snapshots нет. В кошелёк и ledger атомарно записываются150 и stream/sequence/id. Следующая sequence должна идти без пробела; уже обработанная последовательность не начисляется заново. Только затем удаляется **точный** native pending. Failed grant не ack; failed ack допускает recovery/restart без повторной выдачи. Pending→JS и завершение bridge-запроса идут через одну очередь. Обычный autosave не владеет старым полным snapshot.

Ошибка рекламного recovery/ack не блокирует действия и не открывает обязательный retry. Повторы5/10/20/30с идут в фоне; здоровая сверка раз в30с подхватывает потерянный earned callback. Зависший native pending/status/ack не порождает вторую такую RPC; поздний pending ответ сохраняется до применения. Только настоящий конфликт или неопределённый исход ценной записи защищается отдельным save recovery. Конфликт второго writer имеет приоритет и требует reload. Покупка подсказок не запускает автоматически поиск по устаревшему prefix; пользователь снова нажимает помощь.

## Переход и жизненный цикл

Continue выполняется после сохранённой победы. Обычная collect-анимация заканчивается до fullscreen. Dismissal или отсутствие готового interstitial продолжают переход один раз. Если dismiss приходит, пока native/document background ещё установлен, переход ждёт foreground вместо потери команды. Повторные клики, изменения revision из-за намеренной блокировки рекламы и выход из SDK Activity не уничтожают следующую задачу.

Gift защищает свой переход через persisted level marker; rewarded защищает текущий переход и запускает общий cooldown. Конец90 задач не показывает interstitial. После нетворк-ошибок нет немедленного autoretry; interstitial preloading имеет30с backoff. Loading rewarded ограничен12с; отсутствие pre-show callback можно завершить только до фактического показа/потери фокуса. Отображаемая реклама не прерывается общим timeout.

Banner/cadence пересчитываются также при смене отдельного blocker без aggregate edge: фон внутри уже открытой паузы проверен отдельным сценарием с высотой SDK90px.

Баннер невидим во время fullscreen и после закрытия не возвращается поверх rewarded-модали. Возобновляется только на подходящей игровой поверхности; pause разрешён продуктовыми правилами, фон запрещён. SDK refresh остаётся SDK, повторных per-frame загрузок нет. Geometry requests coalesced, старые generations не используются.

## SDK и конфигурация

Официальный Yandex Mobile Ads **8.6.0**, AppMetrica **8.6.0** (обновлена с8.5.1 по текущему integration guide), без mediation bundle. Gradle/SDK зависимости закреплены, manifest игровой Activity сохраняет `portrait`. Сторонняя рекламная Activity проверяется на устройстве отдельно.

Генератор `tools/android.mjs` создаёт нативный `assets/road-ads.json`, не Vite-константы и не release window hooks:

| Переменная | Назначение |
|---|---|
| `ROAD_LINES_AD_MODE=demo` | Официальные demo-banner/interstitial/rewarded-yandex; разрешено только при `ROAD_LINES_PLAYTEST=true` |
| `ROAD_LINES_AD_MODE=live` (по умолчанию) | Раздельные ID ниже; отсутствующий ID отключает формат |
| `YANDEX_BANNER_AD_UNIT_ID` | Собственный Android banner block |
| `YANDEX_INTERSTITIAL_AD_UNIT_ID` | Собственный Android interstitial block |
| `YANDEX_REWARDED_AD_UNIT_ID` | Собственный Android rewarded block |
| `APPMETRICA_API_KEY` | Нативный transport; отсутствие ключа означает disabled, не доказательство доставки |

Автоматический GitHub debug APK использует demo. Перед live-сборкой нужны собственные три ID и ключ аналитики; конфигурация логируется только как enabled/disabled/mode, значения не печатаются. Через GitHub connector доступность этих secrets подтвердить не удалось, их наличие не предполагается. APK остаётся `.playtest`, с прежней debug-подписью и отдельным от основного приложения сохранением. Ни публикация в магазине, ни релизная подпись в пакет не входят.

Обычная web production-сборка — честный unavailable adapter; реальной web-рекламы нет. Диагностический `ads-test` — отдельный compile mode; исходники тестового bridge и маркеры `test-ad-pending`/`test-stream` исключены из normal production bundle. GIF такого сценария демонстрирует UI начисления/покупки, **не** реальный рекламный SDK или наличие инвентаря.

## Измерение и проверки

Typed события `ad_offer`, `ad_event` (request/loaded/load_error/show/impression/earned/dismiss/show_error), `ad_reward_granted`, `hint_purchase`, `result_continue`, `ad_next_level`. Durable grant/purchase события идут после подтверждённой записи. Запросы/возможности/показы не смешиваются. Доставка AppMetrica и реальные рекламные показы требуют dashboard/device проверки; компиляция это не доказывает.

Команды:

- `npm run check`:427 tests/64 files на момент реализации, включая миграции, покупки, readback, failed grant/ack, повтор/restored receipt, active-time cadence и защиту подарка.
- `node tools/monetization-smoke.mjs`: explicit test build и отдельная проверка отсутствия mock markers в production;13 browser flow groups,10 viewport/language combinations. Реальные UI события; SDK заменён только в этом compile mode.
- `node tools/persistence-smoke.mjs`, `node tools/celebrations-smoke.mjs`, `node tools/analytics-smoke.mjs`, localization/playtest/reload-touch и baseline production/inspection из CI.
- `node tools/performance-audit.mjs --prepare-only` и `node tools/performance-regression.mjs`: ограниченные renderer/cleanup regressions; новый полный memory soak не заявляется.
- Android CI: реальная компиляция SDK/bridge. Native screenshot/демо показ/физическая приёмка, process death внутри SDK, живой revenue/fill и аналитический dashboard остаются отдельной проверкой.

В первом CI localization timeout произошёл при ожидании Next после reload; повтор локальной полной матрицы прошёл. Причина в CI пока не доказана, это не объявляется исправленным дефектом по одному успешному прогону. Финальные результаты/commit/APK hash фиксируются отдельно в evidence.

## Источники API, проверены 2 ноября 2026

- [SDK integration](https://ads.yandex.com/helpcenter/en/dev/android/quick-start), [changelog](https://ads.yandex.com/helpcenter/en/dev/android/changelog-android).
- [SDK8 migration](https://ads.yandex.com/helpcenter/en/dev/android/release/8-0-0-migration): AdRequest с placement в constructor, per-load callbacks, YandexAds, sticky API.
- [Rewarded](https://ads.yandex.com/helpcenter/en/dev/android/rewarded), [Interstitial](https://ads.yandex.com/helpcenter/en/dev/android/interstitial), [Sticky banner](https://ads.yandex.com/helpcenter/en/dev/android/adaptive-sticky-banner).
- [AppMetrica8.6 changelog](https://yandex.ru/support/appmetrica-io/en/sdk/android/changelog-android).

Прежние x5/direct-theme/extra-wheel не включены, ценные награды/каталог/банк90 не изменены. IAP/No Ads/подписка не реализованы по утверждённому scope.
