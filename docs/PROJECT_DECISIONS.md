# Road Lines — решения проекта

## 2026-10-29: Android-first вместо Yandex Games web bootstrap
Контракт продукта: TypeScript + Phaser + Vite + Capacitor; Android/RuStore, портрет. Нативная реклама Yandex Mobile Ads.
Шаблон kit bootstrap/yandex-phaser предназначен для Yandex Games web, использует веб-SDK, GameplayAPI/LoadingAPI и landscape/portrait gate. Его обязательная политика относится к новым Yandex Games web-проектам, которым Road Lines сейчас не является.

Замена: отобранные framework-independent модули с точными source SHA плюс собственный Capacitor scaffold на этапе 0. Сохраняем принципы: real/mock separation, осмысленный first-presentable-frame, диагностика запуска, безопасный viewport, cleanup и отдельная release-приёмка.
Не переносим веб-Player Data, веб-рекламу, Yandex DRAFT/upload audit и landscape sizing как рабочие Android-механизмы.
Если появится отдельный Yandex Games web target, пересмотреть bootstrap для этого target явно.
Доказательство текущего этапа: API/исходники/тесты донора проверены; Android scaffold ещё не создан.

## 2026-10-29: локальный source snapshot вместо Git dependency
Kit experimental, а нужная receipt queue ещё в отдельной ветке. В vendor/mini-games-kit переносится выбранный замкнутый набор TS-модулей, focused docs и регрессионных тестов.
main: 5450f9db344aacb5acdc103b4199fd8aeb11b10d.
Seeds extraction: d4dee18c9b466e2b4a68d8d481db6dfc50ec9ee5.
Не мержим ветки донора и не создаём зависимость от moving branch. Manifest фиксирует происхождение каждого файла. Код и тесты без семантических изменений; два barrel-файла сокращены до реально перенесённых exports. Ссылки omitted docs направлены на закреплённый upstream.
Это перенос, а не доказательство интеграции модулей в игру.

## 2026-10-29: portrait v1 и viewport kit
BrowserViewportWatcher и resolveViewportState могут помочь с наблюдением геометрии. Экспортированные landscape sizing helpers сохранены для целостности исходника/его регрессионных тестов, но НЕ являются раскладкой Road Lines.
Не вызывать default orientation blocker, который блокирует portrait. Собственная портретная раскладка и native safe insets обязательны.

## 2026-10-29: награды и автосохранения
Для локального выбора награды — DurablePendingTransactionSession. Для нативного earned callback — DurableReceiptQueue. Это разные границы.
RevisionSnapshotQueue пригоден только для полных обычных снимков. Нужна собственная сериализация всех изменений сохранения, остановка устаревших producers и rebase после транзакции. Нельзя считать две независимые очереди одной транзакцией.
Дедупликация, схема кошелька, receipt targets и нативный журнал остаются работой Road Lines.

## 2026-10-29: приоритет продуктового плана
docs/reference-reproduction-plan.md определяет внешний результат, контент, цены и предварительные тайминги. Kit даёт механизмы, не баланс, графику и UX.
В частности: generic Android recipe советует скрывать banner при dialogs; в Road Lines banner остаётся в pause, но скрыт при win/skin offer/wheel/fullscreen ad.
Восьмисекторное колесо, три звезды за первое решение, цены и частота рекламы — решения v1, не доказанные правила конкурента.

## 2026-10-29: каркас этапа 0
Phaser 4.2.1, Vite 8.3.5, Capacitor core/cli/android 8.5.3, App plugin 8.1.2; версии закреплены lockfile. Phaser проверен фактической browser-сборкой.
Поле/лента — Phaser Graphics; HUD, доступные кнопки/диалог и будущий native banner slot — DOM. Так сохраняются доступные кнопки и корректное измерение slot. Модель появится отдельно.
Canvas backing store использует capped DPR до 2; геометрия фигуры остаётся в CSS-пикселях. Ввод этапа 1 должен учитывать ту же границу координат.
Каркас портретный; max-width 600 CSS px на большом browser окне. Фигуры масштабируются относительно ширины, короткий viewport ограничивает высоту.
Android app id: com.danilah.roadlines. Native overlays versioned в native/android; /android генерируется закреплённой CLI и не редактируется вручную. Native root единожды применяет system/cutout insets.
Inspection result — fixture только в Vite mode inspect; production не переключается по query. Это не заработанная награда и не рабочий полный цикл.
Lifecycle: document visibility + native App state + pause через kit coordinator; native Back переключает паузу. Startup ready после первого render, двух paint opportunities и platform setup. Есть сообщения ошибки/долгого запуска.
Рекламный SDK не добавлен. Нативная компиляция локально не подтверждена; workflow подготовлен с JDK 21/SDK 36.

## 2026-10-29: playable stage 1
Чистая модель маршрута и bounded DFS solver отделены от Phaser. Ввод на DOM host считает пересечения отрезка с центральными прямоугольниками клеток в CSS px; это сохраняет промежуточные клетки даже при одном быстром pointermove. Только ортогональные последовательные рёбра, только последовательный обратный откат. Pointer capture, cancel, exit, resize, пауза и фон завершают жест без сброса маршрута.
Worker создаётся на запрос и terminate на отмену/изменение prefix. Solver budget 200 мс, внешний deadline 1500 мс учитывает запуск worker. FOUND/UNSOLVABLE/UNKNOWN различаются; списание только после durable save найденной полезной подсказки. Бледное продолжение — до трёх следующих клеток. Доказанный тупик может предложить ближайший проверенный откат.
Первый банк: 15 собственных масок, 3–25 клеток. Полные witnesses проверяет отдельный Node validator, который не импортирует игровой solver/model. Канонизация по 8 симметриям исключает повтор одинаковой формы. Witness не ограничивает принимаемое решение.
Сохранение v1 — один компактный JSON localStorage с синхронной атомарной заменой. Обычный prefix coalesced таймером 80 мс, flush на завершении жеста/паузе/фоне/pagehide. Победа, coins и first-clear сохраняются вместе сразу. Маленький state пока не требует JsonStorageRepository/RevisionSnapshotQueue; не добавлять вторую очередь записей без реальной нужды. Внутренняя baseline обновляется только после подтверждения записи; ambiguous write проверяется обратным чтением. Неизвестный исход блокирует дальнейшие mutations до reload.
Браузер удерживает Web Lock на save всю сессию; вторая вкладка получает понятный отказ. Дополнительно проверяется raw baseline перед каждой записью и storage events. На старом WebView без Web Locks действует single-instance договорённость + детектор конфликтов, не распределённая CAS-гарантия.
Частично повреждённый prefix/устаревшая версия уровня сбрасывается к start, но coins/completed не угадываются. Нечитаемый durable state сохраняется и показывает ошибку, не silently default.
Базовая награда +20 и first-clear введены сейчас для корректного завершения/повторов. Presentation наград пока статический; звук/haptics, monetization и каталог остаются в следующих этапах.
