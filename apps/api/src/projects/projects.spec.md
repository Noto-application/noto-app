# Spec: Projects CRUD

**Статус:** Draft
**Дата:** 2026-08-07
**Связанные:** [ADR-011](../../../../docs/adr/011-authorization-acl.md), [RFC-001](../../../../docs/rfc/001-api-contract.md), issue #27

## Цель

Бэкенд для проектов: создать / читать / переименовать / удалить. Проект —
единица доступа ([ADR-011](../../../../docs/adr/011-authorization-acl.md)),
страницы живут внутри (Pages — отдельная задача).

## Вне scope

- Управление участниками (инвайты, смена роли, удаление участника) — отдельная задача
- Pages CRUD, вложенность страниц
- Публикация, восстановление из корзины (только пометка удаления)

## Контракт

ts-rest контракт в `@noto/shared`. Единый shape ошибок `{ code, message, details? }`
([RFC-001](../../../../docs/rfc/001-api-contract.md)).

| Метод  | Путь            | Кто                              | Успех             |
| ------ | --------------- | -------------------------------- | ----------------- |
| POST   | `/projects`     | любой авторизованный (→ `owner`) | `201 { project }` |
| GET    | `/projects`     | участник                         | `200 { projects[] }` |
| GET    | `/projects/:id` | участник (любая роль)            | `200 { project }` |
| PATCH  | `/projects/:id` | `editor`+                        | `200 { project }` |
| DELETE | `/projects/:id` | `owner`                          | `204`             |

Коды ошибок: `UNAUTHORIZED` 401, `FORBIDDEN` 403 (новый код), `NOT_FOUND` 404,
`VALIDATION_ERROR` 400.

## Поведение

- **create**: в одной транзакции создаётся `Project` + `ProjectMember(role=owner)`
  для текущего пользователя.
- **list**: проекты, где для пользователя есть `ProjectMember`; `deletedAt = null`.
- **update**: меняет `name`.
- **delete**: soft-delete — ставит `deletedAt`; проект (и его страницы) исчезают
  из выдачи. Восстановление/корзина — отдельная задача.

Доступ проверяет `ProjectAccessGuard` + `@RequireProjectRole` (ADR-011): достаёт
`projectId`, находит `ProjectMember` пользователя, сравнивает роль по иерархии
`owner > editor > viewer`.

## Крайние случаи

| Случай | Ожидание |
| ------ | -------- |
| create без авторизации | `401 UNAUTHORIZED` |
| create с пустым / слишком длинным `name` | `400 VALIDATION_ERROR` |
| list — чужие проекты | не видны |
| list — удалённые проекты | не видны |
| get: не участник | `403 FORBIDDEN` |
| get / update / delete: несуществующий id | `404 NOT_FOUND` |
| update ролью `viewer` | `403 FORBIDDEN` |
| delete ролью `editor` / `viewer` | `403 FORBIDDEN` |
| повторный delete уже удалённого | `404` — soft-deleted трактуется как несуществующий |
| get / patch уже удалённого | `404` — soft-deleted инертен во всех операциях |

## Взаимодействия

- **Prisma**: `Project`, `ProjectMember`, enum `ProjectRole` (ADR-011); `deletedAt`
  на `Project`. Миграция в git.
- **Guard**: `ProjectAccessGuard` + `@RequireProjectRole`, код `FORBIDDEN` в общий
  error-shape.
- **Server state**: на фронте — TanStack Query (FE-3, [ADR-005](../../../../docs/adr/005-state-management.md)),
  вне этой задачи.

## Решения

- Повторный `delete` / любой доступ к уже удалённому проекту → `404`
  (soft-deleted трактуется как несуществующий во всех операциях).
- **Проверка существования (404) идёт раньше проверки прав (403).** Не участник,
  запрашивающий удалённый проект, получает `404`, а не `403` — не раскрываем факт
  существования.
- **Восстановление удалённого — вне scope этого модуля.** Корзина (restore) —
  отдельная фича с выделенным эндпоинтом (`POST /projects/:id/restore` или
  trash-namespace) и своим доступом; обычные `get` / `patch` над удалённым
  остаются `404`.

## Открытые вопросы

- `slug` / `published` — только на `Page` (по ADR-011) или что-то на `Project`?
  В этой задаче на `Project` не заводим.
