# Spec: Collab auth — авторизация Yjs-документа на WS-хендшейке (#108)

**Статус:** Draft — read-only `viewer` на Hocuspocus (#149): тесты на ревью, реализация после апрува
**Автор:** Stas Kobles
**Дата:** 2026-09-08
**Обновлено:** 2026-09-28 — `viewer` подключается к документу, но не пишет (#149)
**Связанные:** [RFC-003](../rfc/003-yjs-provider.md), [ADR-006](../adr/006-realtime.md),
[ADR-011](../adr/011-authorization-acl.md), [ADR-012](../adr/012-api-contract.md),
[ADR-003](../adr/003-authentication.md), issue #108, issue #149, PoC #99

## Цель

Подключиться к Yjs-документу страницы через Hocuspocus может **только участник
её проекта**. Проверка выполняется на WebSocket-хендшейке и опирается на
существующую авторизацию API (JWT + `ProjectMember`), без дублирования логики.

## Топология

```
Browser ──(cookie access_token)──► Caddy (единый origin, WS Upgrade)
                                     ├── /api/*   ► apps/api  (REST)
                                     └── /collab  ► apps/collab (Hocuspocus WS)

apps/collab ──onAuthenticate──► apps/api  POST /internal/collab/authorize
                                (внутренняя сеть, НЕ через публичный proxy)
```

- `documentName = pageId` (голый UUID, без префикса) — **согласовано**.
- Публичный proxy отдаёт наружу только `/api/*` и `/collab`; `/internal/*` из
  публичной маршрутизации исключён. Но «API недоступен в обход Caddy» —
  требование **уровня деплоя**, не приложения: в dev API слушать на loopback,
  в проде — приватная сеть без публикации порта API. На уровне приложения
  endpoint защищает сервисный секрет `X-Collab-Secret` (defense-in-depth).
- Access-cookie `access_token` HttpOnly → клиентский JS её не читает, поэтому
  в `HocuspocusProvider({ token })` не передаётся. Единый origin (Caddy) →
  cookie сама уходит на `/collab`, collab читает её с upgrade-запроса.

## Поведение

### WS-хендшейк (apps/collab, `onAuthenticate` → `authorizeConnection`)

Порядок и решения (любой не-happy путь → **отказ**: доступ к документу
запрещён, данные не отдаются; `throw` в `onAuthenticate` Hocuspocus 2.15.3
отклоняет авторизацию, но мгновенный разрыв самого WS не гарантирует —
безопасность держится на том, что неавторизованному не отдаётся контент):

1. `Origin` отсутствует, равен строке `null` или не совпадает **точно** с
   элементом allowlist (`COLLAB_ALLOWED_ORIGINS`) → отказ, **API не зовём**
   (защита от CSWSH). Сравнение — точное равенство origin, без нормализации
   слэша/регистра.
2. Пустой `documentName` → отказ, API не зовём.
3. В cookie нет `access_token` → отказ, API не зовём (нечего авторизовать).
4. Иначе `POST /internal/collab/authorize` с `documentName`, извлечённым
   `access_token` и сервисным секретом.
5. **Fail-closed:** пропускаем **только** при
   `200 { allowed: true, userId, role }`, где `userId` — непустая строка, а
   `role` — одно из `owner` | `editor` | `viewer`. Любой иной ответ
   (`401/403/404/400/500`, `allowed:false`, невалидное тело, отсутствующий/пустой
   `userId`, отсутствующая/пустая/неизвестная `role`), **таймаут** или сетевая
   ошибка → отказ. По таймауту HTTP-запрос отменяется (`AbortController`),
   чтобы зависшие запросы не накапливались. Роль нельзя подставлять по
   умолчанию: иначе соединение стало бы записываемым.
6. Проверка выполняется **на каждый запрашиваемый документ** (onAuthenticate на
   коннект/док), не кэшируется на уровне соединения.

При успехе `userId` кладётся в контекст соединения. `role` превращается во флаг
записи Hocuspocus (следующий раздел) и в контекст не дублируется отдельно от
этого флага.

**Передача в API:** только `documentName`, значение `access_token` и сервисный
секрет. Прочие cookie не пробрасываем. **Токены и секрет не логируем** ни при
успехе, ни при отказе.

### Internal endpoint (apps/api) `POST /internal/collab/authorize`

- Вне глобального префикса `/api` (Nest `setGlobalPrefix(..., { exclude })`),
  путь `/internal/collab/authorize`.
- Контракт — ts-rest + Zod ([ADR-012](../adr/012-api-contract.md)) в
  `@noto/shared/internal` (`internalCollabContract`), **общий** для apps/api
  (реализация через `@ts-rest/nest`) и apps/collab (клиент через
  `@ts-rest/core` `initClient`); в публичный `apiContract` НЕ входит. Тело
  `{ documentName: uuid }`, невалидное → `400 VALIDATION_ERROR` (маппит
  `ApiExceptionFilter`).
- Аутентификация пользователя — **тем же** механизмом, что REST (cookie
  `access_token` + верификация access-JWT). Нет/битый/просроченный токен →
  `401 UNAUTHORIZED`.
- Сервисный секрет `X-Collab-Secret` (env `COLLAB_SHARED_SECRET`) ограничивает
  вызов только от collab. Нет/неверный секрет → `403 FORBIDDEN` (проверяется
  **до** пользовательской авторизации — гейт вызывающего).
- Существование страницы — **как в `PageAccessGuard`**: живая страница в живом
  проекте (`page.deletedAt === null && project.deletedAt === null`), иначе
  `404 NOT_FOUND`. Скрывает факт существования от постороннего.
- Членство — `assertProjectRole(prisma, page.projectId, userId, 'viewer')`.
  Не участник → `403 FORBIDDEN`. `viewer` в комнату **пускаем**: отказ по роли
  ниже `editor` здесь не делаем.
- **Пригодность режима (поправка от #109):** после членства проверяется
  `editorMode`. `collab` → пускаем; `rest` + пустой `content` (`[]`) →
  промоутим в `collab` (атомарно) и пускаем; `rest` + непустой `content` →
  `409 CONFLICT` (старую REST-страницу нельзя обнулить collab-документом).
  Детали и гонки — в [persistence.spec.md](../../apps/api/src/collab/persistence.spec.md) (#109).
- Успех → `200 { allowed: true, userId, role }`. `role` — роль
  `ProjectMember` этого пользователя на проекте страницы (`owner`, `editor`
  или `viewer`).

**Порядок проверок (что течёт наружу):** секрет (403) → пользовательский JWT
(401) → валидация тела (400) → существование (404) → членство (403) →
пригодность режима (409, #109).

### Запись на соединении Hocuspocus (#149)

Проверка «может ли писать» — на WebSocket, в `onAuthenticate`, через
`connection.readOnly` Hocuspocus 2.15.3. Соединение `viewer` не отклоняем:
он получает текущий документ и дальнейшие правки других участников.

- `role === 'viewer'` → `connection.readOnly = true`.
- `role === 'editor'` или `'owner'` → `connection.readOnly = false`.
- Флаг выставляется **до** выдачи документа (Hocuspocus читает его и при
  ответе об успешной аутентификации, и при создании `Connection`).
- Read-only соединение по-прежнему получает синк документа и рассылку чужих
  обновлений. Его собственные update (sync step 2 и update) сервер **не
  применяет** к `Y.Doc` и поэтому **не сохраняет** в persistence. Клиенту уходит
  sync status «не принято».
- `403` за роль `viewer` не возвращаем и страницу в collab из-за этого не
  закрываем. Членство и промоут пустой REST-страницы (#109) не меняются.

Клиентский `editable` редактора эту проверку не заменяет: граница — серверный
`readOnly`.

### Запуск (apps/collab)

- Пустой/отсутствующий `COLLAB_SHARED_SECRET` **запрещает старт** сервиса
  (валидация конфига падает при загрузке, а не на первом коннекте).
- `COLLAB_ALLOWED_ORIGINS` — список разрешённых origin (как `CORS_ORIGIN` в API).

## Вне scope #108

- **Persistence** Yjs-state (`onLoadDocument`/`onStoreDocument`) — #109.
  Read-only соединение само по себе снапшот не пишет: его update не попадает
  в документ.
- Presence-курсоры и комментарии — Socket.io, отдельно.
- Скрытие ввода в BlockNote у `viewer` — отдельно от серверного `readOnly`.
- Миграция REST-контента страниц в Yjs.

## Тестируемая логика (test-first, ADR-013)

- **apps/api** — e2e internal endpoint: секрет, JWT (вкл. просроченный),
  контракт тела, членство, 404 на удалённую страницу/проект. Успех включает
  `role` участника (`viewer` тоже `200`, не `403`).
- **apps/collab** — unit `authorizeConnection`: allowlist origin, извлечение
  cookie, fail-closed на все не-`200 allowed` и на ответ без валидной `role`,
  таймаут, ошибка, отсутствие логирования токена/секрета. `viewer` →
  `readOnly: true`, `editor`/`owner` → `readOnly: false`. Unit
  `applyHocuspocusReadOnly`: флаг пишется в `connection.readOnly`, соединение
  не отклоняется. Unit конфига — запрет пустого секрета.

Живой WS (два клиента, рассылка, отказ update у `viewer`) — спайк, не unit
(по CLAUDE.md realtime = спайк). Решение о `readOnly` unit-тестами покрыто.

## Браузерный спайк (без тестов)

- Реальный круг: cookie → Caddy → collab `/collab` → API `/internal/...`.
- Caddy с явной поддержкой WebSocket Upgrade.
- Отказ подключения постороннего к чужому документу.
- **Отказ к чужому документу на уже открытом WS** (переключение документа в
  рамках соединения проходит повторную авторизацию).
- **При отказе клиент не получает данных документа** (пустой/закрытый, без
  утечки контента).
- **`viewer` видит правки `editor` в реальном времени** и не может их изменить:
  его ввод не появляется у другого клиента и не сохраняется после повторного
  открытия.
- **Internal endpoint недоступен через публичный proxy** (`/internal/...`
  снаружи не резолвится).
