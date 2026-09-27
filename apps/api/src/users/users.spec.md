# Spec: Users — чтение профиля и username

**Статус:** Draft
**Дата:** 2026-09-16
**Связанные:** [ADR-003](../../../../docs/adr/003-authentication.md), [ADR-012](../../../../docs/adr/012-api-contract.md), [auth.spec.md](../auth/auth.spec.md), issue #124

## Цель

Авторизованный пользователь читает свой профиль и задаёт отображаемое имя
(`username`): первый раз или смена. Без имени приложение работает как раньше.

## Вне scope

- Создание пользователя — только в auth (`POST /auth/register`).
- Смена email, пароля, аватара, удаление аккаунта.
- Уникальный хэндл, публичные профили чужих пользователей, поиск по имени.
- Сброс `username` в `null` (только добавить или заменить).

## Контракт

ts-rest контракт в `@noto/shared` (`usersContract`). Единый shape ошибок
`{ code, message, details? }` ([ADR-012](../../../../docs/adr/012-api-contract.md)).
Все пути под префиксом `/api`. Запросы — `credentials: 'include'`.

| Метод | Путь              | Кто                         | Тело              | Успех         |
| ----- | ----------------- | --------------------------- | ----------------- | ------------- |
| GET   | `/users/me`       | текущий (access cookie)     | —                 | `200 { user }` |
| PATCH | `/users/:userId`  | только свой `userId`        | `{ username }`    | `200 { user }` |

Коды ошибок: `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
`VALIDATION_ERROR` 400.

**Форма `user`** (тот же публичный DTO, что у auth register/login/me; без
`passwordHash`):

| Поле        | Тип                | Заметка                                      |
| ----------- | ------------------ | -------------------------------------------- |
| `id`        | `string` (uuid)    |                                              |
| `email`     | `string`           |                                              |
| `username`  | `string \| null`   | `null`, пока пользователь не задал имя       |
| `createdAt` | `string` (ISO)     |                                              |

`GET /auth/me` возвращает тот же `user`, включая `username` — сессия сразу
видит имя, отдельный запрос к `/users/me` не обязателен.

## Поведение

- **GET `/users/me`:** текущий пользователь из access cookie → `200 { user }`.
  `username` может быть `null`. Строки в БД нет, а токен ещё жив → `401`
  (как `GET /auth/me`), не `404`.
- **PATCH `/users/:userId`:** если `userId` не совпадает с id из токена →
  `403 FORBIDDEN` (без чтения БД, не раскрываем существование id). Свой id →
  trim пробелов по краям, длина 1–80 → сохранить → `200 { user }` с новым
  именем. Повторный PATCH заменяет имя.

Регистр и внутренние пробелы сохраняем (`Ivan Petrov` валиден). Уникальность
не проверяем: это отображаемое имя, не хэндл.

Register/login **не** принимают `username`; у нового пользователя поле `null`.

## Крайние случаи

| Случай | Ожидание |
| ------ | -------- |
| GET / PATCH без авторизации | `401 UNAUTHORIZED` |
| GET `/users/me`, пользователя уже нет в БД (cookie ещё жива) | `401 UNAUTHORIZED` — как `/auth/me` |
| PATCH чужого `userId` (существующего или нет) | `403 FORBIDDEN` |
| PATCH своего id, пользователя уже нет в БД | `404 NOT_FOUND` |
| `username` пустой / одни пробелы / длиннее 80 | `400 VALIDATION_ERROR` |
| `username` с пробелами по краям | сохраняется обрезанным |
| пользователь без `username` | GET `/users/me` и `/auth/me` — `username: null`, остальное работает |
| не-uuid в `:userId` | `400 VALIDATION_ERROR` |

## Взаимодействия

- **Prisma:** на `User` опциональное поле `username String?` (без unique).
  Миграция в git. Создание пользователя по-прежнему в auth.
- **Auth:** публичный DTO общий; `toPublicUser` отдаёт `username`. Register не
  меняется.
- **Server state:** на фронте — TanStack Query ([ADR-005](../../../../docs/adr/005-state-management.md));
  после PATCH инвалидировать и профиль, и `/auth/me`. Вне этой задачи.

## Решения

- Поле в API и БД — `username` (issue: «имя»). Не unique, не lowercase.
- Чужой профиль не читаем и не редактируем в этом модуле: GET только `/users/me`,
  PATCH чужого id → `403`. Публичный DTO содержит `email` — чужие профили
  отдельно, со своим DTO.
- Очистить имя нельзя: пустая строка после trim → `400`, не `null`.
