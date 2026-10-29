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
Работают 15 собственных задач: непрерывная лента и пунктир, быстрый свайп, обратный откат, отпускание/продолжение, пауза, рестарт, подсказка в worker и сохранение. Можно также двигаться стрелками после фокуса на поле.
Принимается любое законное решение. За первое прохождение сохраняются 20 монет и отметка прохождения; повтор не дублирует награду. Победа анимирована: импульс и миниатюра фигуры, буквы/звёзды, три выброса конфетти, сбор монет к счётчику. Есть процедурные звуковые эффекты и native Android вибромост. Каталог, колесо и рекламные SDK ещё не подключены.
На старте 3 подсказки; доказанный тупик предлагает бесплатный откат. Ошибка/таймаут поиска не тратит подсказку. Рекламное пополнение добавляется на этапе рекламы.

Inspection-сборка: `npm run build:inspect`, `npm run preview`, затем `?screen=result` для fixture результата или `?level=15` для заданного поля. В production query не управляет игрой; обычный результат появляется после реального решения.

## Проверки
- `npm run check` — целостность переноса, типы приложения и kit, 114 tests (97 kit + 17 game/presentation).
- `npm run test:browser` — пять viewport, все 15 решений, откат/reload, worker hint, тупик, touch cancel/второй палец, изоляция вкладок, resize; screenshots в `.test-output`.
- `node tools/browser-smoke.mjs --production` — тот же shell без inspection route.
- `npm run android:sync` — production web build, создание/обновление Android с native overlays.
- `npm run android:build` — debug APK при JDK 21+ и SDK 36. В CI есть отдельный Android workflow.

[Android и воспроизводимость](docs/ANDROID_SETUP.md). Android debug APK текущего игрового этапа [собран в CI](https://github.com/DanilaH/road-lines/actions/runs/40942705635). На физическом устройстве ещё не проверен. Подробная проверка — [STAGE2_VALIDATION.md](docs/STAGE2_VALIDATION.md).

Звук и вибрация выключаются раздельно в паузе; настройки сохраняются. Prefers-reduced-motion уменьшает движение и число частиц. Компиляция вибромоста не доказывает его силу на конкретном телефоне.
