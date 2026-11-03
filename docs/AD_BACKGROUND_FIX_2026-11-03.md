# Реклама не блокирует игру — 3 ноября 2026

Причина наблюдаемого отказа: ошибка pending/ack поднимала `ad-recovery-error` и запрещала Play/Back/Continue. Из прошлой защиты receipt ошибочно получилась обязательная проверка рекламы для всей игры.

В runtime `2d42e6c8477c6622bb139c81e6594f4c19e84b0f` эти blockers, guards и обязательное рекламное retry-окно удалены. Pending/status/ack работают в фоне. После ошибки паузы повторов5/10/20/30с; сверка здорового журнала раз в30с. Зависшая native операция не порождает новые идентичные RPC; поздний pending ответ сохраняется до применения. Interstitial preload повторяется через30с даже на длинном уровне. Ошибка рекламы не выдаёт монеты и не удаляет журнал.

Когда приходит валидный receipt, один синхронный writer сохраняет текущий prefix, читает authoritative save и атомарно заменяет coins+ledger. Между этими действиями нет await; обычные producers используют актуальный store.state. Query/ack не отменяют жест или solver. Grant обновляет UI до ожидания ack; failed ack допускает траты заработанных денег и restart без повторного grant. Только настоящий конфликт/неопределённый storage write сохраняет отдельную защиту valuable save.

Проверки:238 application tests/31 files,97 kit tests/17 files;5 новых fault cases (missing pending, offline retry/latest prefix, late response, lost ack/purchase, dispose). Browser: startup4, monetization14 groups/10 screen-language combinations, persistence18, localization10+24, analytics10, reload-touch4. Offline включён через browser context после загрузки локальных ресурсов; это не подтверждение физического телефона. Production не содержит test ad adapter. APK/demo mode, package/signature и встроенные assets проверяются отдельно в evidence.

Native fullscreen load/show guards остаются отдельными от receipt recovery: реально открытая реклама продолжает использовать свой activity blocker до закрытия. Не применён общий timeout, способный возобновить игру под реально показанным SDK окном. Конкретная причина отсутствия native pending ответа на телефоне не установлена без device logs; исправлена ошибочная зависимость игры от этого ответа.
