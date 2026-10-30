# Колесо и коллекционные экраны

30 октября 2026. Пользователь одобрил развитие принятого стиля меню/HUD на оставшиеся экраны.

- Наборы: большая цветная поверхность и настоящая маска доступного набора. Подготовляемые наборы остаются disabled, не подменяются фиктивными уровнями.
- Уровни: прежние 5 колонок / 15 задач; отдельные материалы completed/current/locked. SVG показывает только mask/start, не witness или маршрут решения. Tap targets сохранены.
- Каталог: прежние 8 палитр, два free/шесть по 500. SVG preview использует те же theme tokens, градиент и нижний слой. Selected check, owned action и lock/price различимы; данные покупки/ownership не менялись.
- Колесо: фиксированный металлический обод, равные cream/purple сектора, неподвижный медальон, pointer feedback и подсветка actual last.sector. Угол/суммы/шансы и durable journal не менялись. CSS pointer animation отключается stop/dispose/reduced motion. Нет дополнительных звуков/вибрации на каждую рамку.

Новые bitmaps, font assets или JS dependencies не добавлены. Поле, его геометрия/материалы и ScreenMotion не менялись.

Проверки: npm run check — 145 tests/22 files, typecheck, manifest и independent 15-shape audit. Inspect browser smoke — 320×568,360×800,390×844,412×915,576×1280, все 15 pointer-прохождений, themes/purchases/Back, reward stage/commit/reload/background/failure. Production smoke также прошёл на пяти viewport и всех 15 задачах. Оба CI успешны на 2fb39b9d5d52cc8af7225b61d0debba810529f78: App and kit checks 41081633963, Android debug build 41081633863. GIFs снимаются из настоящего UI с законным прогрессом, не из макета. Debug APK предназначен для проверки управления/плавности/звука/вибрации, не является signed release или device acceptance.

APK artifact 12989631806 (road-lines-debug): ZIP SHA256 f860bff54f43d4ad0932041c66d06e18e44a07dcf13695381a8fd329d0b3594a. Извлечённый APK 4701292 bytes, SHA256 3573316adcc20bc88e442ac4cb1311e39231c793e04152f558fcb29207d4bcf6. ZIP digest сверён до extraction; в APK проверены новые wheel/level UI и font license. Физическое устройство ещё не проверено.
