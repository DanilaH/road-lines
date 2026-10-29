# Road Lines

Fill-головоломка: заполнить фигуру одним непрерывным маршрутом. Цель — близко воспроизвести управление, композицию, награды и ритм выбранного конкурента, затем развивать свою версию.

Стек: TypeScript + Phaser + Vite + Capacitor; Android, portrait; Yandex Mobile Ads.

## Начать здесь
- [AGENTS.md](AGENTS.md) — обязательный рабочий контракт.
- [План](docs/reference-reproduction-plan.md) — полный scope, механики и критерии этапов.
- [Карта kit](docs/KIT_INTEGRATION.md) — перенесённые решения и границы.
- [Решения](docs/PROJECT_DECISIONS.md) — Android/web различия и provenance.
- [Статус](docs/IMPLEMENTATION_STATUS.md) — готовое и следующий шаг.

## Проверка подготовки
Node 24; npm ci; npm run check.
Пока проверяются только перенесённые примитивы. Игровое приложение ещё не создано.
Не выдавать зелёные kit-тесты за готовность игры или нативной рекламы.
