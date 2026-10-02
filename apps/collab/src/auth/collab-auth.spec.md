# Spec: Collab auth — доступ к странице и Yjs-документу (#108, #149)

**Статус:** Draft — контракт на ревью до реализации
**Автор:** Stas Kobles
**Дата:** 2026-09-08
**Обновлено:** 2026-09-30
**Связанные:** [ADR-003](../../../../docs/adr/003-authentication.md), [ADR-006](../../../../docs/adr/006-realtime.md), [ADR-011](../../../../docs/adr/011-authorization-acl.md), [ADR-012](../../../../docs/adr/012-api-contract.md), issue #108, issue #149, [RFC-003](../../../../docs/rfc/003-yjs-provider.md), PoC #99

## Цель

Участники проекта читают страницу, а право изменять её содержимое определяется ролью и режимом хранения. `viewer` может читать Yjs-документ в режиме read-only; запрет записи обеспечивает collab-сервер, а UI отражает это ограничение.

## Вне scope

- Отзыв прав у уже установленных WS-соединений и управление участниками.
- Multi-instance coordination, отдельный read-only Yjs-документ и отдельный REST-снапшот collab-контента.
- Awareness, presence, курсоры, комментарии и Socket.io ACL.
- Миграция сохранённого REST-контента в Yjs.

## Контракт

### Чтение и изменение страницы

- `GET /api/pages/:pageId` проверяет access JWT, существование страницы и членство с минимальной ролью `viewer`. DTO содержит `editorMode` и обязательный `currentUserRole: owner | editor | viewer`, вычисленный API для аутентифицированного пользователя по членству в проекте. Клиент использует только это поле для read-only UI, не выводит роль из наличия действий или состояния sync. Чтение ничего не меняет.
- `PATCH /api/pages/:pageId` требует `editor` или `owner`. В режиме `rest` можно менять REST-поле `content`. В режиме `collab` изменение `content` через REST отклоняется с `409 CONFLICT`; актуальное тело хранится в Yjs. Другие разрешённые поля страницы изменяются по существующему контракту.

### Internal collab authorization

- `POST /internal/collab/authorize` — внутренний endpoint, вне публичного `/api`; общий ts-rest/Zod контракт находится в `@noto/shared/internal`. Запрос содержит `{ documentName: uuid }`, access-cookie `access_token` и `X-Collab-Secret`. Collab передаёт API только значение access-токена, не весь Cookie header.
- Успех: общий ts-rest/Zod контракт `internalCollabContract.authorize` в `@noto/shared/internal` задаёт ровно обязательные поля `200 { allowed: true, userId, role, canWrite }`. `role` — `owner | editor | viewer`; `canWrite` — обязательный boolean, вычисляемый API по той же роли (`false` для viewer, `true` для editor/owner`). API-ответ, схема пакета shared и типизированный клиент collab должны совпадать; локальные альтернативные формы ответа запрещены.
- Collab строго проверяет `allowed === true`, непустой `userId`, известную `role`, boolean `canWrite` и согласованность роли с capability. `viewer + true` и `editor/owner + false` — невалидные ответы и отказ в WS-доступе. Отсутствующую capability нельзя считать `false` или выводить/подменять по роли; валидный `canWrite` определяет `connection.readOnly`.
- Ошибки: `403 FORBIDDEN` при неверном/отсутствующем сервисном секрете, отсутствии членства или запросе viewer на REST-страницу; `401 UNAUTHORIZED` при отсутствующем/невалидном/просроченном JWT; `400 VALIDATION_ERROR` при невалидном теле; `404 NOT_FOUND` для отсутствующей/удалённой страницы или проекта; `409 CONFLICT` при попытке editor/owner открыть REST-страницу с непустым `content` в collab.
- Проверки internal endpoint: секрет → JWT → валидация тела → существование → членство → режим и право перехода. Viewer получает `200` только для страницы с `editorMode = collab`; запрос viewer для `editorMode = rest` всегда получает `403` и не меняет `editorMode` или `content`. Editor/owner могут атомарно промоутить только пустую REST-страницу; непустой REST-контент даёт `409` без изменения данных. Endpoint не входит в публичный `apiContract`.

### WebSocket / Yjs

- `documentName` равен `pageId` (UUID без префикса). Access JWT приходит в HttpOnly cookie; клиентский JS не передаёт токен.
- Коллаб-сервер проверяет Origin по точному allowlist `COLLAB_ALLOWED_ORIGINS` до запроса API. Отсутствующий Origin, `null`, неразрешённый Origin, пустое имя документа или отсутствие access-cookie закрывают доступ; API при этом не вызывается для невалидного Origin, имени документа или cookie.
- Проверка выполняется на каждую авторизацию документа. Токен и секрет не логируются. Таймаут API отменяет запрос через `AbortController`.
- Успешная авторизация передаёт `userId` в контекст и устанавливает `connection.readOnly` до выдачи документа: `canWrite: false` → `true`; `canWrite: true` → `false`.

## Поведение

1. Клиент загружает DTO через `GET`. Роль `viewer` достаточна для чтения страницы; сам `GET` не меняет `editorMode` или `content`.
2. Клиент выбирает режим по `editorMode`, а права UI — по обязательному `currentUserRole` из DTO. В REST- и collab-режимах viewer видит документ, но BlockNote остаётся `editable = false` до и после первого успешного sync и последующих live-обновлений. Editor/owner становятся редактирующими только после успешного sync. Неизвестная или отсутствующая роль обрабатывается fail-closed: редактор не редактируемый. UI-ограничение — UX, оно не заменяет серверный `connection.readOnly`.
3. Для страницы `editorMode = rest` читается REST-поле `content`. Viewer не может менять его и не открывает для этой страницы Yjs-сессию. Если он всё же запрашивает WS напрямую, internal endpoint отвечает `403`, не меняя страницу. Editor/owner могут редактировать REST-контент и начать переход пустой страницы в collab.
4. Для страницы `editorMode = collab` клиент подключается к Hocuspocus. Viewer получает начальный документ и последующие изменения других участников, но его updates не применяются к Y.Doc и не попадают в persistence. Editor/owner могут читать и менять документ.
5. Editor/owner могут начать переход пустой REST-страницы (`content: []`) в `collab`: переход атомарный, затем открывается WS-документ. REST-страница с непустым `content` не промоутится и даёт `409`; исходный контент сохраняется.

## Крайние случаи

- Любой ответ API, кроме валидного `200` по общей Zod-схеме с непустым `userId`, известной ролью и boolean `canWrite`, приводит к отказу. Отсутствующий/невалидный `canWrite`, неизвестная роль или несоответствие роли capability не разрешают запись и не открывают документ. В частности, `viewer + canWrite: true` и `editor/owner + canWrite: false` должны дать `{ allowed: false }`. Таймаут и сетевая ошибка также закрывают доступ.
- Удалённая страница или проект дают `404` до проверки членства; посторонний пользователь получает `403`.
- Параллельные запросы editor/owner на первый переход REST → collab не должны терять контент: максимум один выполняет переход, остальные допускаются только после подтверждения `editorMode = collab`. Viewer не участвует в этом переходе. Гонка с REST-записью должна завершаться ровно одним допустимым результатом, см. [persistence.spec.md](../../../../apps/api/src/collab/persistence.spec.md) (#109).
- Тест setter-функции `applyHocuspocusReadOnly` подтверждает только отображение boolean в `connection.readOnly`; он не доказывает, что production `onAuthenticate` применяет результат авторизации. До появления unit/integration-проверки hook обязательна live-проверка в реальном окружении: два браузерных клиента, viewer остаётся не редактируемым после sync, видит документ и live-обновления editor, а попытка изменения (в том числе WS update в обход UI) не меняет документ другого клиента и не сохраняется после повторного открытия. Editor/owner могут писать; при отказе данные документа не выдаются.

## Взаимодействия

- `apps/web`: DTO страницы предоставляет `currentUserRole`; `editorMode` выбирает REST-редактор или Hocuspocus, роль задаёт `editable`. Проверка должна подтверждать viewer `editable = false` в REST-редакторе и до/после sync в collab-редакторе, а также `editable = true` для editor/owner после sync. Неизвестная роль не включает редактирование.
- `apps/api`: guards проверяют JWT, существование и ProjectMember; `CollabService` авторизует WS и контролирует допустимый переход режима.
- `apps/collab`: Hocuspocus `onAuthenticate` проверяет Origin, вызывает internal endpoint, валидирует ответ и выставляет `connection.readOnly`.
- `packages/shared`: единый internal ts-rest/Zod контракт; internal endpoint не публикуется через Caddy. Публичный proxy маршрутизирует `/api/*` и `/collab`, но не `/internal/*`; API должен оставаться в приватной сети. `COLLAB_SHARED_SECRET` обязателен при старте.
- Состояние страницы (`editorMode`, REST `content`) хранится на сервере. Тело collab-документа принадлежит Yjs/persistence; его нельзя дублировать в Zustand или TanStack Query. `pageId` остаётся в URL.
- Unit-тесты отдельно проверяют схему общего контракта, fail-closed для обеих противоречивых пар `role/canWrite` и mapping-функцию `connection.readOnly`; API e2e проверяют роль в DTO, запрет viewer-промоута без изменения `editorMode/content` и разрешённый переход editor/owner. UI-тесты проверяют роль-независимое read-only состояние viewer после sync. До интеграционного теста production hook реальное применение флага и realtime-поведение подтверждает обязательная live-проверка.

## Решения для реализации

- Источник роли UI — `currentUserRole` в DTO страницы, вычисленный API из ProjectMember. Роль не берётся из WS-контекста, локального состояния или эвристик.
- API `canWrite` и DTO `currentUserRole` используют одну и ту же актуальную роль участника. `canWrite` — серверная capability для collab-соединения; `currentUserRole` — проекция для UI и не является механизмом безопасности.
