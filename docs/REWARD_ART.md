# Наградные объекты

30 октября 2026. По запросу пользователя: встроенная генерация изображений, без чужих ассетов. Два самостоятельных объекта в единой фиолетово-золотой палитре. Это декоративные изображения, не новая валюта или механика.

## Runtime

| Файл | Canvas | Байты | Использование |
|---|---:|---:|---|
| src/assets/rewards/gift.webp | 384×384 | 15000 | Окно подарка |
| src/assets/rewards/gift-small.webp | 96×96 | 2660 | Прогресс подарка и его вход в меню |
| src/assets/rewards/medallion.webp | 128×128 | 4102 | Вход ежедневной награды и неподвижный центр колеса |

Итого 21762 байта. Transparent WebP quality 88 / alpha quality 100; без увеличения разрешения. Source alpha сохранён; trim → contain → прозрачный square canvas. Alpha bounds (>8): gift (59,55)–(334,340), gift-small (14,13)–(84,85), medallion (14,13)–(114,113). Минимальный прозрачный отступ 44/11/13 px соответственно. Проверены sRGBA, квадратный canvas, ненулевой объект и прозрачная рамка. Для обработки использован ImageMagick; политика сверена с docs/assets/ASSET_PIPELINE.md донора, без обновления pinned vendor или новых runtime зависимостей. Vite imports управляют хешированными URL; большая картинка запрашивается только при показе окна подарка, не через JS draw-loop. Маленький gift Vite может inline как data URL.

Изображения decorative (alt empty, aria-hidden); значения/навигация/доступность остаются настоящими DOM. Исходные картинки не попадают в runtime. Движение подарка ограничено лёгким float; reduced motion его отключает. Изображения не владеют начислением наград и не заменяют три звезды результата. Центр колеса не вращается с секторами и не перекрывает числа.

## Prompts / source

Built-in image generation, stylized-concept; true transparent background requested for both. No reference images / no competitor assets. Original generated PNGs остаются отдельными исходниками генерации.

Gift source: exec-c7f6c2c9-904f-4d99-9ab9-a278524ebcec.png.

Final prompt: One beautiful tactile chunky violet gift box with rich warm golden satin ribbon and thick sculpted bow; lid slightly lifted by 5 percent with subtle golden light in seam. Premium casual puzzle 3D art, clean bevels, refined soft glossy materials, rounded cube, three-quarter front view, upper face visible, centered fully within square with transparent padding. Purple #8550ed, gold #ffd249, amber shadows, cream upper-left highlights, gentle ambient occlusion. Readable at 96px. Only box and bow; no floating confetti, sparkles, particles, pedestal, coins, scenery, text, logo, border, watermark or floor shadow. True transparent background.

Medallion source: exec-236d4078-5bdf-4eb1-97b2-0b8882b9c9e9.png.

Final prompt: Single chunky golden circular medallion, face almost front-on with slight three-quarter depth, centered fully visible with transparent padding. Thick polished bevel, warm yellow gold #ffd249, amber lower edge, soft cream upper-left highlight. Inlaid raised violet #8550ed emblem: simple bold squared U-turn zigzag orthogonal puzzle path with two rounded endpoints. Premium casual puzzle 3D art, refined glossy materials, sculpted depth, coherent lighting; readable at 48px. No hanging ribbons or loops, face, surrounding stars or coins, sparkles, scenery, floor shadow, text, numbers, letters, logo, watermark or frame. True transparent background.

## Проверки и ограничения

Приёмка требует просмотра реального меню, результата и колеса на коротком/обычном телефоне, загрузки всех изображений и прежнего игрового цикла. Gift threshold 20 по-прежнему недостижим в текущем банке 15: окно визуально можно проверять только как явно обозначенный presentation fixture; это не доказательство получения подарка в production.

Локально прошли typecheck, inspect browser smoke (пять viewport, 15 задач, меню/темы/reward flows) и отдельная проверка decode всех видимых reward-img, результата, wheel hub во время вращения и presentation-only gift fixture. Production smoke также прошёл на пяти viewport и всех 15 задачах. Дополнительно подтверждены gift-card в 320×568 и animation:none при reduced motion. Код: b20b70d7a33b54b5297722a7ca3a5c8acba65f22. Android debug build 41051284315 прошёл; App and kit checks 41051284113 ещё выполняется. Нативная приёмка на телефоне не выполнена. Зависимости восстановлены offline из package-lock: Phaser 4.2.1, Vite 8.3.5; проверки на временном стороннем наборе зависимостей не считаются evidence.

## Исправление раскрытия — 2 ноября 2026
Пользователь отверг плоский SVG-подарок и попросил разделить прежний объёмный ассет с задней стенкой. Крышка с бантом и передние внешние грани GiftReveal теперь являются SVG-clips неизменённого src/assets/rewards/gift.webp. Оригинальные gift.webp/gift-small.webp/medallion.webp не изменены. Новая подложка src/assets/rewards/gift-interior.webp содержит две задние внутренние грани, толщину ободка и дно. Она клиппируется в отверстие за исходными передними стенками: открытая коробка имеет четыре стенки.
Built-in image_gen, precise-object-edit, reference — существующий gift.webp. Source exec-3dca58cc-b7da-419b-8f2e-1e191569f6d1.png, 1536×1024 RGBA, две ячейки. Сгенерированная крышка слева НЕ используется: сохранены пиксели оригинала. Interior из правой ячейки: ImageMagick crop620×536+840+292 →384×332 →transparent WebP quality90/alpha100, 12116bytes.

Final prompt (built-in):
Use case: precise-object-edit. Edit target: the attached existing premium glossy violet-and-gold gift icon. The user loves this exact gift, preserve its identity, rounded bevels, chunky satin gold bow, ribbon shape, purple materials, proportions and the SAME elevated three-quarter camera. Create an animation parts sheet on a real transparent background, landscape 1536x1024, TWO equal-width cells separated by generous clear space. LEFT CELL: only the original detached lid with its complete gold ribbon and bow, including the thick purple lid side skirt and original highlights, no box body. RIGHT CELL: only the corresponding open box body with lid removed, same exterior golden ribbon bands, hollow opening with a clearly visible thick rear wall and two rear inner faces, side walls, front walls, rim thickness and a visible recessed interior bottom. It must be a complete physically credible four-sided box, NOT a two-sided U-shaped shell and NOT a solid closed cube. A warm cream-gold lining catches light inside the purple box; keep violet exterior. Both pieces use the same camera, identical perspective and same outside WIDTH in their respective equal cells, so they can be layered back into the original gift. Fully detached isolated objects; no light rays, no surrounding glow or particles (those will be animated in code), no text, no outlines, no numbers, no panel dividers, no UI. No shadow on background, retain true transparent padding. Do not reinvent the object or replace it with a flat vector icon.

Свет — кодовый конус из отверстия, мягкий ореол и локальная подсветка внутренности с occlusion передними стенками. Конфетти — два выброса48+40 вместо28, яркие чипы/кружки/ленты с фазами взлёта и падения. Длительность ограничена2.5с, элементы удаляются после окончания и при отмене. Монеты/сохранения/экономика не менялись. Reduced motion сразу показывает открытую коробку без частиц и движения.
