# Этап 2 — проверка 2026-10-30

## Локально пройдено
- npm run check: vendor integrity, все 15 witnesses/уникальные формы, TS и 114 tests / 19 test files.
- Geometry: расширение до shrink, точное совпадение конца с целевой миниатюрой, конечные положительные размеры.
- Cue plans: ограниченные частоты/громкости/длительности, рост высоты, rate gates, win не теряется из-за предыдущего cell cue; независимость настроек.
- Inspection и production browser smoke: пять viewport + resize + все 15 задач через настоящий pointer pipeline.
- WebAudio instrumentation только в тесте: один реальный AudioContext, создание oscillator sources при игре/победе, отсутствие новых voices при mute. Это не прослушивание и не оценка тембра пользователем.
- Реальная canvas celebration: painted alpha pixels, полный viewport 390×844; scatter содержит 16 coin tokens. Просмотрен screenshot победы: три звезды, видимая миниатюра, разные частицы/ленты, reward UI. Удалена лишняя рамка фокуса на результате.
- До полёта coins durable баланс уже 20, visual counter ещё 0. Reload сохраняет 20 без повторной выдачи.
- Симулирован visibilitychange во время самой победы: таймер scatter отменён, visual counter settled, после resume старый scatter не появляется.
- Симулирован visibilitychange во время collect: delayed navigation отменена, current level сохраняется, coins остаются 80, FX nodes убраны. После resume обычное продолжение работает.
- Double click Continue не пропускает уровень. Все 15 побед дают 300 coins, повтор не добавляет валюту.
- Worker/dead end/undo/cancel/second touch/writer lock regression cases этапа 1 продолжают проходить.
- npm run android:sync успешно генерирует source custom plugin, регистрацию и VIBRATE permission.

## Пределы доказательств
Симуляция document visibility не заменяет Android background/audio-focus тест. CDP touch не заменяет реальный палец. Силу мотора, совпадение звука с движением и subjective game feel на телефоне здесь не оценивали.
Межстраничка/rewarded/каталог/колесо и магазинный release отсутствуют; disabled x5 не является интеграцией рекламы. Полоска подарка отражает first-clear progress, само открытие награды ещё в следующих этапах.
Новый native plugin должен отдельно пройти CI compile; результат прогона фиксируется ниже после завершения. На физическом устройстве не запускался.

## Проверить руками в первой сборке
Быстрый маршрут и откат; последние клетки; три тактильных удара победы; звёзды/монеты/звук; раннее продолжение; mute/vibration toggle; фон/возврат; несколько уровней подряд. Не называть всё это подтверждённым по зелёному CI.
