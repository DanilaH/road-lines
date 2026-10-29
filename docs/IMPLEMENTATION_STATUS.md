# Статус Road Lines

Обновлено: 2026-10-29.

## Подготовка — готово
План, AGENTS.md, kit snapshot, provenance, 97 regression tests и CI.

## Этап 0 — готов; browser CI и Android debug build прошли
- Phaser 4.2.1 + Vite + Capacitor 8.5.3, закреплённый lockfile.
- HUD и статическая фигура; пауза/возврат; место баннера.
- Статический результат в отдельной inspect-сборке.
- Resize/DPR, startup ready/ошибка, document/native lifecycle, native Back.
- Воспроизводимая Android-генерация с versioned portrait/inset/theme/icon overlays.
- Browser smoke и Android debug workflow.
- Типы/97 tests, production и inspection browser smoke на пяти viewport пройдены. Capacitor add/sync успешны, повторное применение overlays идемпотентно.
- На коммите e5b6edb43cf88e399fa9ac4060dbf8984d75d49a прошли App and kit checks и Android debug build. APK загружен в artifact road-lines-debug; физический телефон и release acceptance ещё не проверены. См. STAGE0_VALIDATION.md.

## Следующий этап: 1
Модель маршрута, сегментный ввод, быстрый свайп, откат/продолжение, solver в worker, первые 15 задач, сохранение.

## Затем
2. Полный праздничный цикл — первая плейтест-сборка.
3. Меню, темы, прогресс, колесо.
4. Нативная реклама и durable receipts.
5. 90 задач, RU/EN, release acceptance.
6. Сверка с референсом, затем новое.

## Ещё не реализовано
Механика/solver/контент, настоящие награды, звук/вибрация, Yandex Mobile Ads, APK для выпуска. Текущие поле, баланс и результат — статические fixtures для layout-приёмки.
