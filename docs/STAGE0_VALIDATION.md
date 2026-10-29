# Этап 0: проверка — 2026-10-29

## Локально пройдено
- npm run check: целостность 71 vendor-файла, типы приложения и kit, 17 test files / 97 tests.
- npm run typecheck после последних изменений renderer/layout.
- npm run test:browser: inspection-сборка; play/pause/Back/result/next, отсутствие баннера на результате, читаемые зоны без перекрытия; пять размеров 320×568, 360×800, 390×844, 412×915, 576×1280, DPR 2; отдельный live resize.
- node tools/browser-smoke.mjs --production: пять viewport; параметр screen=result не включает fixture результата в обычной сборке.
- Вручную просмотрены PNG игрового экрана и результата, включая короткий экран. Поправлены DPR-резкость и рамка стартовой клетки. Финальные PNG создаёт browser smoke в .test-output; их повторный визуальный просмотр нужен после дальнейших UI-изменений.
- npm run android:sync: успешны cap add, применение overlays и cap sync. Повторное применение MainActivity/manifest/theme/icon не меняет их hashes.
- Подключение @capacitor/app обнаружено при sync.

## Ограничения
Тесты выполнены на уже установленных локальных зависимостях закреплённых версий. Clean registry download здесь не выполнялся. Lockfile dependency graph проверяется npm ci dry-run отдельно; это не доказательство чистой загрузки.
Локальная npm run android:build останавливается preflight: только Java 17, отсутствует Android SDK. Java-код не скомпилирован, физический телефон/Insets/Back/rewarded не проверены.
Добавлен Android debug workflow с JDK 21/SDK 36. Удалённый CI на момент записи не заявляется успешным. Signed release APK, реклама, настоящие транзакции и игровой ввод не реализованы.
На этапе 0 поле, баланс и result — fixtures для композиции, а не сыгранный уровень.

## Хеши production web build
```
dist/assets/esm-BadSmh0y.js 286f7e46253f5a48dc483b8d331b90da46ce54aa5bc6bdd23fb4fcade91f0bff
dist/assets/esm-PQVHPieT.js 81b7e1df0de2ba33bb6e4deb7fd683b401c8d60567f43b45365e3331c221170b
dist/assets/esm-x1Khe5lz.js 853550750c09f89a97d2545934ccbd2b2e69f66752fecb8affb33593610326f1
dist/assets/index-CILr2q5x.js 6ff3334cdc6d0f68580dfa156863ab373a7ad4edc5965fde20d2f5a515df2ed8
dist/assets/index-DZXmGNHO.js 134831f7b67c8778da1005cd7bc24f4f6110c6b3c73bda89c32ad715ce2812a4
dist/assets/index-Dwiv8qaw.js c200c283c481120699ed74b2e23ca091fbcb7c5539b4ca2013bb8ceee1f7ddfc
dist/assets/index-vyvZDb2s.css a5fa3bd3b625512fcb073d69709bcc55687c392cafa985c43ca1672c01a5939f
dist/assets/web-Bnc927dd.js 244476d7c06becebdb58522057883bb52a2429f47427cb3971d766a572624567
dist/assets/web-CYXbfimm.js e44c1b9296e3ffc8839f29b9290feb647ca3e70884baccde4f2dac07eeb5762d
dist/assets/web-DDhT1GId.js 87070cd4a015b8a4d1822127ee307344534a065d77254dd89356fdeef1ca1d34
dist/index.html 5ffc9d1e789147d67f78e30dfb473094e5a0ba396acba08d53b4d0c730a2632e
```
