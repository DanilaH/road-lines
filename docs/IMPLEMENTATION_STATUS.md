# Статус Road Lines

Обновлено: 2026-10-30.

## Готово
Этапы 0 и 1: Phaser/Vite/Capacitor, 15 задач, ввод/откат/worker hints, сохранения/first-clear. Их CI проверены ранее.
Этап 2 реализован: появление клеток и локальная реакция, импульс→миниатюра, живые буквы/звёзды/Continue, fullscreen confetti, coin transfer, gift progress, собственные звуковые cues и native vibration plugin. Sound/vibration settings раздельные.
Локально 114 tests, пять viewport, все 15 input-прохождений, cancellation/double-click/mute проверки пройдены. Итоговые App and kit checks и Android debug build прошли на 2dc955d8b9fd0d11c161a62469fabf7005ee02b8; см. STAGE2_VALIDATION.md.

## Сейчас
Этап 3, первая часть: главное меню, наборы, сетка 15 задач, последовательное открытие/звёзды/повторы, настройки из меню, Back и завершение набора реализованы. Маршруты начатых задач сохраняются отдельно; старое сохранение мигрирует без сброса кошелька. 120 unit tests, android:sync, inspect/production browser flows и оба CI прошли на code commit 4733ad7f95c60bff75c47605a23c84ce69db54cc. APK и результаты — STAGE3_NAVIGATION_VALIDATION.md.
Первая полноценная сборка для device playtest. Компиляция не доказывает силу вибрации/качество звука и ощущений; physical device acceptance ещё не пройден.

## Темы
Каталог 8 тем и покупка реализованы: 2 бесплатные, 6 по 500, общая палитра UI/Phaser, подтверждение и атомарное сохранение ownership/coins/themeId. Миграция v1→v2. 131 tests, inspect/production browser flows, android:sync и оба CI прошли на 9e303b4a34caa3ff6fa14844bfd43f9064b160b1. APK и evidence — STAGE3_THEMES_VALIDATION.md.

## Награды и колесо
Экраны и локальная логика этапа 3 реализованы: ежедневное колесо, durable pending/recovery, gift ledger и предложение темы. Схема v3. Свежий CI восстановленной версии проверяется; evidence — STAGE3_REWARDS_VALIDATION.md.
В текущем банке 15 задач, поэтому подарок за 20 первых прохождений пока недостижим. Реальные видеонаграды остаются этапом 4.

## Далее
4. Реальные Android banner/interstitial/rewarded + durable receipt journal/ack.
5. 90 отобранных задач, RU/EN, производительность, signed release acceptance.
6. Сверка с конкурентом; затем новые идеи.
