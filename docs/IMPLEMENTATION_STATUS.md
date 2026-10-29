# Статус Road Lines

Обновлено: 2026-10-29.

## Готово
- Подробный план воспроизведения референса.
- Отбор и перенос TS-механизмов, API-документации и исходных regression tests mini-games-kit.
- Отдельно закреплённый перенос Seeds receipt handoff.
- Корневой AGENTS.md, карта интеграции, явные отличия от Yandex web bootstrap.
- Инструменты проверки переноса и CI.

## Следующий этап: 0
- Создать Phaser/Vite app и Capacitor Android shell.
- Проверить Phaser version/API совместимость и актуальные native SDK требования.
- Зафиксировать package id и воспроизводимую нативную структуру.
- Собрать статические игровой экран и результат, portrait/safe-area/banner slot.
- Привязать реальный/mock platform lifecycle, startup и диагностику.
- Добавить команды app build, browser smoke и Android build.

## Ещё не реализовано
Игровое поле/ввод, solver, уровни, экраны игры, награды, звук, вибрация, нативные SDK и приложение.
Ни browser acceptance, ни device acceptance, ни signed APK сейчас не заявлены.

## Порядок далее
1. Ввод, solver и 15 задач.
2. Полный праздничный цикл — первая плейтест-сборка.
3. Меню, темы, прогресс, колесо.
4. Реклама и native lifecycle.
5. 90 задач, RU/EN, release acceptance.
6. Проверка сходства и только потом добавление нового.
