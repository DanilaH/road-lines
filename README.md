# Road Lines

Fill-головоломка: заполнить фигуру одним непрерывным маршрутом. Цель — близко воспроизвести управление, композицию, награды и ритм выбранного конкурента, затем развивать свою версию.

Стек: TypeScript + Phaser + Vite + Capacitor; Android, portrait; Yandex Mobile Ads.

## Начать здесь
- [AGENTS.md](AGENTS.md) — обязательный рабочий контракт.
- [План](docs/reference-reproduction-plan.md) — полный scope, механики и критерии этапов.
- [Карта kit](docs/KIT_INTEGRATION.md) — перенесённые решения и границы.
- [Решения](docs/PROJECT_DECISIONS.md) — Android/web различия и provenance.
- [Статус](docs/IMPLEMENTATION_STATUS.md) — готовое и следующий шаг.

## Запуск
Node 24, затем `npm ci` и `npm run dev`.
`npm run build` собирает обычное приложение; `npm run preview` открывает сборку локально.

## Текущий этап
Готов каркас: Phaser-поле, HUD, пауза, место баннера и отдельный статический результат. Рисование, solver, награды и настоящий рекламный SDK ещё впереди. Стартовая фигура и баланс — presentation fixtures, без сохранения и начислений.

Результат доступен только в inspection-сборке: `npm run build:inspect`, затем `npm run preview` и `?screen=result`. В обычной сборке этот параметр не включает результат.

## Проверки
- `npm run check` — целостность переноса, типы приложения и kit, 97 regression tests.
- `npm run test:browser` — пять viewport, пауза/возврат, результат, живое изменение размеров; screenshots в `.test-output`.
- `node tools/browser-smoke.mjs --production` — тот же shell без inspection route.
- `npm run android:sync` — production web build, создание/обновление Android с native overlays.
- `npm run android:build` — debug APK при JDK 21+ и SDK 36. В CI есть отдельный Android workflow.

[Android и воспроизводимость](docs/ANDROID_SETUP.md). Локально APK не скомпилирован: нет SDK 36/JDK 21. Подробная проверка — [STAGE0_VALIDATION.md](docs/STAGE0_VALIDATION.md).
