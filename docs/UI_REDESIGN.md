# Меню и игровой HUD — первый проход

30 октября 2026. Разрешён пользователем после критики интерфейса как бедного/шаблонного. Конкретный scope: довести меню и HUD до цельного образца, затем переносить композиционные решения на другие экраны.

Меню: собственная SVG-лента с глубиной и пунктиром, типографическая двухстрочная надпись, приоритет «Играть», функциональный subtitle уровня, самостоятельные вторичные плитки, ежедневная награда отдельной строкой. Настройки перенесены в доступную кнопку header. В коротком экране title/hero перестраиваются, без перекрытия play.

HUD: компактный двухстрочный номер, мягкий золотой wallet, отдельные материалы hint/pause и тихий restart. Все action targets минимум 48 CSS px. Баланс остаётся полным числом; font-size ограничивается по числу цифр. Новых наград/платных действий нет. На результате обычное продолжение получило primary; неработающий до ads x5 визуально вторичен.

Типографика: Nunito variable 200–1000, self-hosted Latin/Cyrillic subset 72636 байт. Source: https://github.com/google/fonts/tree/main/ofl/nunito, исходный blob 2ec1f4b0676c83ef33049db87b311171699e9192. OFL.txt поставляется рядом. Subset: U+0000–024F,0400–052F,2000–206F,20BD,20AC; WOFF2. CSS font-display swap. Runtime не обращается к Google Fonts.

Классическая тема: молочный #fff9ef, ink #362447, фиолетовый ribbon/primary #8550ed. Сохранены остальные семь тем и права владения. CSS shell.css загружается после базового style.css; scope ограничен presentation. Экономика, solver, input geometry и vendor не менялись.

Проверено:
- npm run check: manifest 71 файла/66 unchanged, independent audit 15 уникальных форм; typecheck; 145 tests/22 files.
- npm run test:browser: 320×568,360×800,390×844,412×915,576×1280, live resize, все 15 pointer-прохождений, cancel/undo/hints, navigation/themes/rewards/recovery.
- node tools/browser-smoke.mjs --production: тот же цикл в production, inspection route исключён.
- Дополнительно: Cyrillic font decode; reduced motion; герой не пересекает play; обычная/тёмная темы; wallet 999999 не выталкивает controls на трёх размерах.
- Визуально просмотрены меню 320/390, игра, пауза, победа, тёмный UI. GIF записан из production настоящими input-событиями, не mockup.

Ограничения: Android workflow запускается после commit; физическая плавность/вибрация/звук не проверены. Полная новая композиция wheel/catalog/level-grid — следующий UI-проход, сейчас они используют общий шрифт и палитру.
