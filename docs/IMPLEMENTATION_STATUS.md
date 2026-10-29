# Статус Road Lines

Обновлено: 2026-10-29.

## Подготовка — готово
План, AGENTS.md, kit snapshot, provenance, 97 regression tests и CI.

## Этап 0 — каркас реализован; Android-компиляция ожидает CI
- Phaser 4.2.1 + Vite + Capacitor 8.5.3, закреплённый lockfile.
- HUD и статическая фигура; пауза/возврат; место баннера.
- Статический результат в отдельной inspect-сборке.
- Resize/DPR, startup ready/ошибка, document/native lifecycle, native Back.
- Воспроизводимая Android-генерация с versioned portrait/inset/theme/icon overlays.
- Browser smoke и Android debug workflow.
- Типы/97 tests, production и inspection browser smoke на пяти viewport пройдены. Capacitor add/sync успешны, повторное применение overlays идемпотентно.
- APK локально не скомпилирован: нет JDK 21/Android SDK. Remote CI и physical device acceptance не заявлены; см. STAGE0_VALIDATION.md.

## Следующий этап: 1
Модель маршрута, сегментный ввод, быстрый свайп, откат/продолжение, solver в worker, первые 15 задач, сохранение. Проверить Android workflow и исправить ошибки компиляции при наличии результата.

## Затем
2. Полный праздничный цикл — первая плейтест-сборка.
3. Меню, темы, прогресс, колесо.
4. Нативная реклама и durable receipts.
5. 90 задач, RU/EN, release acceptance.
6. Сверка с референсом, затем новое.

## Ещё не реализовано
Механика/solver/контент, настоящие награды, звук/вибрация, Yandex Mobile Ads, APK для выпуска. Текущие поле, баланс и результат — статические fixtures для layout-приёмки.
