# Этап 1 — проверка 2026-10-29

## Реализовано
15 задач, route input, прямоугольная лента/пунктир/head/start, последовательный откат, отпускание/продолжение, бесплатные сброс/undo, пауза, bounded worker hints, восстановление prefix и durable first-clear/+20. Сохранения не зависят от анимаций.

## Локальные результаты
- npm run check: vendor integrity, независимый validator всех 15 задач, типы и 110 tests (97 kit + 13 game), 18 test files.
- Полные witnesses не содержат повторов/незаконных рёбер/выходов за границы; все 15 масок различны с учётом поворотов/отражений.
- Solver сравнен с независимым исчерпывающим oracle для каждого достижимого prefix на маленьких полях; проверены FOUND от каждого авторского prefix, доказанный тупик, ближайший recoverable prefix, UNKNOWN по исчерпанию бюджета.
- Альтернативные решения принимаются; проверены запрет диагонали/row wrap/повторного посещения и порядок отката.
- Roundtrip prefix/coins/hints; повторное завершение после reload без второй награды; repair только prefix; плохой durable save не сбрасывается; disk failure и ambiguous acknowledgement не выдают двойную награду; stale writer отвергается.
- Inspection и production browser smoke: пять размеров от 320×568 до 576×1280 с DPR 2, live resize, pause/Escape, DOM bounds.
- Все 15 полных решений проведены через обычные mouse events production input. Первый уровень пройден одним быстрым pointermove; откат и reload/continuation проверены; итог 300 coins, повтор не увеличивает баланс.
- Реальный worker показывает продолжение и списывает одно применение; доказанный тупик предлагает бесплатный откат; заблокированная загрузка worker даёт UNKNOWN без списания.
- Chromium protocol touch: touchCancel сохраняет prefix; второй палец не меняет маршрут. Уход за host завершает жест: re-entry с удерживаемой кнопкой не продолжает линию.
- Второй page того же browser context не получает writer lock. Это проверка вкладок Chromium, не тест нескольких Android WebView.
- Вручную просмотрен активный маршрут задачи 15: лента, пунктир, сохранённый маркер старта, выделенный конец. Оценка приятности/сложности на телефоне ещё не выполнена.

## Границы
Текущий результат без праздничной анимации. Звук/haptics, rewarded, interstitial, каталог/колесо не тестируются и не заявляются. Нет физического Android плейтеста; CDP touch не заменяет реальный палец.
Состояние жеста сохраняется с debounce 80 мс и обязательным flush на lifecycle/конце жеста; abrupt kill до flush не доказывается браузерным reload-тестом. Победа/монеты пишутся сразу одной заменой.
Без Web Locks fallback имеет конфликт-детектор, а не полную межпроцессную блокировку. Нативные внешние receipts ещё не подключены — для них потребуется отдельный durable journal/ack поверх общего writer.
Remote CI и Android compilation текущего коммита фиксируются после завершения прогона.

## Remote CI
Source commit 6f41ebae01095679a460a2e0299062945477956f:
- App and kit checks success: https://github.com/DanilaH/road-lines/actions/runs/40937086291
- Android debug build success: https://github.com/DanilaH/road-lines/actions/runs/40937086361
- Artifact: https://github.com/DanilaH/road-lines/actions/runs/40937086361/artifacts/12925068229
- Artifact ZIP sha256:2a05895fa1a6d6940c600bad55fd66628851733df6fbb126014522e4e6627fed, 4210208 bytes. Это хеш архива GitHub, не извлечённого APK.
Clean npm ci, типы/110 tests, content audit, browser flows и Gradle assembleDebug пройдены. Устройство и release-signing не проверены.
