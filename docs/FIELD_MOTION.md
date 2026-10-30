# Поле и переходы

30 октября 2026. Авторизованный пользователем UI-проход после меню/HUD.

BoardScene сохраняет прежние boardLayout/cellRect и orthogonal route input. Незаполненные клетки получают внутреннюю светотень; лента — нижний слой толщиной до 3.5 CSS px и внешний блик. Radius до 4 px включён только у свободных углов. Bridge рисуется исключительно в промежутке между последовательными соседями маршрута; ambient не менялся. Блик клеток и bridge продолжается по одному краю. Head не заменяет фиксированный start.

shadedRect обходит особенность Phaser Graphics: gradient на rounded paths окрашивает отдельные треугольники. Здесь округлый solid silhouette и прямоугольные градиентные полосы в общей системе координат; диагональных швов нет. Полупрозрачный hint рисуется одним слоем, чтобы alpha не накапливалась от overlapping gradient bands. Canvas fallback остаётся сплошным. Новых bitmap assets/зависимостей/vendor edits нет.

ScreenMotion отвечает только за WAAPI presentation. Меню→игра: инертная уходящая копия меню 160 ms, board opacity 240 ms, HUD translation до 7 px. Board не трансформируется: input geometry стабильна уже в первом кадре. Пауза: opacity/scale только карточки, выходящая копия не перехватывает ввод. Ни один callback не переводит экран и не начисляет награду. Копия удаляет data-action и role, получает inert/aria-hidden; максимум одна одновременно. Новая навигация/блокировка/resize/visibility hidden/dispose отменяют активные эффекты. Reduced motion пропускает эффекты и copies. Promise rejection от cancel обработан.

Проверки:
- npm run check: 71 vendor files / 66 unchanged, 15 independently validated shapes, TypeScript, 145 tests / 22 files.
- Pixel-проверка тем ждёт окончания board fade и outgoing ghost, затем проверяет тот же узкий цветовой диапазон ленты; sample во время overlay fade не считается финальным цветом темы.
- Дополнительный browser flow: ввод до завершения fade; быстрое pause/resume; resize; reduced motion; отсутствие actionable ghosts, сохранение prefix.
- Полный inspect browser smoke прошёл на пяти viewport и всех 15 задачах, включая темы/покупки/reward flows. Production smoke и Android CI запускаются на итоговой версии. Runtime физического Android не подтверждён.
