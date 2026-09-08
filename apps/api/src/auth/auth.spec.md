# Spec: Auth (register / login / refresh / logout / me)

**Статус:** Ready — вопросы согласованы, ждёт финального ревью перед реализацией
**Автор:** Stas Kobles
**Дата:** 2026-07-22
**Связанные:** [ADR-003](../../../../docs/adr/003-authentication.md), [RFC-001](../../../../docs/rfc/001-api-contract.md), [RFC-008](../../../../docs/rfc/008-spec-driven-development.md), issue #3, #4

## Цель

Регистрация и аутентификация пользователя. Приватная зона `/app` доступна только
аутентифицированному пользователю; сессия переживает перезагрузку страницы и
истечение короткого access-токена без повторного логина.

## Вне scope

- Роли и права доступа к ресурсам (ACL проектов/страниц) — отдельный ADR.
- Профиль пользователя, смена пароля, восстановление пароля, email-верификация,
  OAuth/соцсети — отдельные задачи.
- Rate limiting и блокировка после N попыток — отдельно (упомянуть в рисках).
- Guard + `GET /auth/me` — задача #4 (BE-3); здесь только контракт me для полноты.

## Контракт

Все пути под префиксом `/api`. Запросы с фронта — `credentials: 'include'`.
Токены живут **только** в HttpOnly cookie, в теле ответа их нет ([ADR-003](../../../../docs/adr/003-authentication.md)).

| Метод | Путь                 | Тело запроса          | Успех                        | Ошибки                                  |
| ----- | -------------------- | --------------------- | ---------------------------- | --------------------------------------- |
| POST  | `/api/auth/register` | `{ email, password }` | 201, `{ user }` + обе cookie | 409 email занят, 400 валидация          |
| POST  | `/api/auth/login`    | `{ email, password }` | 200, `{ user }` + обе cookie | 401 неверные credentials, 400 валидация |
| POST  | `/api/auth/refresh`  | — (refresh cookie)    | 200, новая пара cookie       | 401 нет/невалидна/просрочена cookie     |
| POST  | `/api/auth/logout`   | —                     | 200/204, обе cookie очищены  | —                                       |
| GET   | `/api/auth/me`       | — (access cookie)     | 200, `{ user }`              | 401 нет/невалиден access                |

- `user` = `{ id, email, createdAt }` — без `passwordHash`.
- Cookie: `access_token` и `refresh_token`, оба `HttpOnly`, `SameSite`, `Secure`
  в production. `refresh_token` — с `Path=/api/auth/refresh` (уже cookie).
- Валидация тела — Zod (задел под [RFC-001](../../../../docs/rfc/001-api-contract.md)); email нормализуется (trim, lowercase).

## Поведение

**Register:** валидируем вход → проверяем уникальность email → хешируем пароль
(argon2id) → в одной транзакции создаём `User` + дефолтный проект «Мой проект» +
`ProjectMember` с ролью `owner` (issue #88; у нового юзера всегда есть
воркспейс) → выставляем access + refresh cookie → 201 `{ user }`.

**Login:** валидируем → находим по email → сверяем пароль (argon2.verify) →
выставляем обе cookie → 200 `{ user }`.

**Refresh:** читаем refresh cookie → проверяем подпись и срок → проверяем, что
`jti` есть в Redis allow-list → выдаём **новую пару** (заменяем `jti` в Redis) → 200. Просрочена/битая/нет cookie/`jti` не в allow-list (отозван) → 401.

Конкурентные `/refresh` с одним и тем же `jti` (proxy + API-клиент, будущий RSC)
не разлогинивают. Короткое **grace-окно** (~10s): ключ старого `jti` не
удаляется и не остаётся `"1"`, а хранит **сериализованную пару токенов
победителя** (access + refresh + новый jti). Повтор в окне — replay этой пары:
тот же 200 и **те же строки** `Set-Cookie`, а не вторая ротация и не перевыпуск
JWT с тем же jti. После окна ключ истекает, старый jti → 401 **без отзыва
семьи** (новый jti остаётся жив). Logout в окне инвалидирует и старый ключ,
и successor (новый jti из кэша). Краденый старый токен в пределах grace
получит ту же валидную пару, что и легитимный клиент — врождённое свойство
идемпотентного replay, не баг.

**Logout:** очищаем обе cookie (`Max-Age=0`) → 200/204. Идемпотентно: без сессии
тоже успех.

## Крайние случаи (будущие тест-кейсы)

- Register с занятым email → 409, пользователь не создан.
- Register: пароль короче минимума / кривой email → 400.
- Login неверный пароль → 401; несуществующий email → 401 (**тот же** ответ, не
  «пользователь не найден» — не раскрывать существование email).
- Refresh без cookie → 401; с истёкшей → 401; с подделанной подписью → 401;
  после logout (jti удалён из Redis) → 401.
- Два параллельных `/refresh` с одним jti → оба 200, **одна** новая пара cookie
  (issue #50).
- Сразу после успешного refresh тот же (старый) jti ещё раз → 200 и та же пара.
- Тот же старый jti после истечения grace → 401; новый jti при этом остаётся
  валиден (семью не отзываем).
- Отзыв **нового** jti внутри grace → повтор старого jti не отдаёт кэш
  отозванной пары (missing). Это явный отзыв, не reuse-detection.
- Новому ключу после ротации ставится TTL refresh (не бессрочный).
- Logout сразу после refresh → и старый, и новый refresh-cookie дают 401.
- Logout инвалидирует refresh немедленно: повторный refresh той же cookie → 401.
- Ответы login/register/refresh **не** содержат токен в теле (только `Set-Cookie`).
- Тайминг: verify пароля выполняется даже для несуществующего email (защита от
  timing-атак по времени ответа).
- passwordHash никогда не уходит в ответе.

## Взаимодействия

- **Prisma** — модель `User` голая: `id (cuid)`, `email (unique)`, `passwordHash`,
  `createdAt`, `updatedAt`. Первая миграция проекта.
- **@node-rs/argon2** — argon2id, параметры по OWASP из конфига.
- **@nestjs/jwt** — подпись access/refresh, секреты и TTL из env.
- **Redis (`ioredis`)** — allow-list refresh (`jti`), TTL = TTL refresh. Модуль
  поднимается вместе с Prisma-фундаментом. `REDIS_URL` — **обязательный**.
- **ConfigModule** — новые env: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=7d`, `ARGON_*` (опц.). `REDIS_URL` —
  сделать обязательным. Дополнить Zod-схему env.
- **CORS** уже настроен в `main.ts` (`credentials: true`, явный origin) — совпадает
  с требованием фронта.
- Состояние на фронте — вне матрицы Zustand ([ADR-005](../../../../docs/adr/005-state-management.md)): сессия определяется
  наличием cookie + `GET /auth/me` через TanStack Query, не Zustand.

## Решения (согласованы с автором, ревью до кода — RFC-008)

- **TTL:** access 15 минут, refresh 7 дней. В env: `JWT_ACCESS_TTL=15m`,
  `JWT_REFRESH_TTL=7d`.
- **Ротация refresh — Redis allow-list.** Каждый `/refresh` выдаёт новую пару и
  заменяет запись. Сервер хранит `jti` активного refresh в Redis:
  - ключ `refresh:{userId}:{jti}`
  - активный: значение `"1"`, TTL = TTL refresh
  - login/register — записывают `"1"`
  - refresh — атомарно: новый ключ `"1"`, **старый ключ на ~10s = JSON пары
    победителя** (grace, issue #50), не указатель «только новый jti»
  - logout — удаляет предъявленный ключ и, если это grace-JSON, successor
  - refresh валиден, только если его `jti` есть в Redis → **настоящий logout и отзыв**
  - **Reuse detection — non-goal (issue #50).** Повтор старого jti после grace →
    401, семью (`jti2` и дальше) не отзываем. Внутри окна краденый токен
    неотличим от гонки двух рефрешеров и получает ту же пару победителя.
    Ловля кражи по повторному jti — отдельно, поверх allow-list.
  - `REDIS_URL` становится **обязательным** (сейчас `optional` в env-схеме — поправить)
- **CSRF:** для MVP — `SameSite` (lax/strict) + строгий CORS-allowlist (запросы с
  credentials не проходят без явного origin). Отдельный double-submit CSRF-токен
  добавим, когда финализируется схема доменов ([ADR-002](../../../../docs/adr/002-routing-and-domains.md) ещё не финал по
  прод-доменам). Отметить как долг.
- **Формат ошибок:** единый shape `{ code, message, details? }` — `code`
  машиночитаемый enum (`INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `UNAUTHORIZED`,
  `VALIDATION_ERROR`), `message` человеку, `details` опционально (ошибки
  валидации). Это образец для всего API ([RFC-001](../../../../docs/rfc/001-api-contract.md)).

## Долги (вне scope задачи, отдельно)

- **Rate limiting** login/register — защита от брутфорса.
- **CSRF-токен** — когда финализируются прод-домены.
- **Reuse detection** refresh — поверх allow-list (осознанно не в #50: после
  grace старый jti даёт 401, без ревока семьи).
