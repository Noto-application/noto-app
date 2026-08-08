# ADR-011: Авторизация и модель доступа (ACL)

**Статус:** Proposed
**Дата:** 2026-08-07

> Принимается на ревью этого PR. До мёрджа — предложение, не окончательное решение.

## Контекст

Аутентификация закрыта ([ADR-003](./003-authentication.md), auth-модуль в main).
Теперь нужна **авторизация**: кто что может делать с проектами и страницами.
PRD требует «создание проектов с группировкой страниц», вложенность, совместное
редактирование несколькими пользователями и публикацию статей с приватностью.

Модель доступа гейтит две вещи: мутации проектов на фронте (FE-3) и бэкенд-задачу
Projects CRUD. Без неё нельзя спроектировать ни то, ни другое.

## Решение

### 1. Единица доступа — проект

Верхняя единица владения и шеринга — **Project**. Отдельного слоя Workspace в MVP
нет (PRD его не требует; в дизайне свитчер есть, но это будущее — обернём позже,
если появятся мульти-команды).

Права цепляются **к проекту**. Страницы проекта **наследуют** его доступ.
Индивидуальная приватность на отдельной странице (page-level override) — вне MVP.

### 2. Роли на проекте

| Роль     | Может                                                             |
| -------- | ---------------------------------------------------------------- |
| `owner`  | всё + управление участниками + удаление проекта                  |
| `editor` | читать/писать контент, создавать и перемещать страницы            |
| `viewer` | только чтение                                                    |

Иерархия: `owner > editor > viewer`. `commenter` — позже (комментарии сами по
себе вне MVP-скоупа).

### 3. Хранение (Prisma)

Явные записи-гранты. Владелец — участник с `role = owner`; отдельного
`ownerId` на проекте не держим, чтобы не плодить второй источник правды.
Инвариант «ровно один owner, его нельзя удалить/понизить» держим в сервисе.

```prisma
model Project {
  id        String          @id @default(uuid())
  name      String
  members   ProjectMember[]
  pages     Page[]
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@map("projects")
}

model ProjectMember {
  projectId String
  userId    String
  role      ProjectRole
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime    @default(now())

  @@id([projectId, userId])
  @@map("project_members")
}

enum ProjectRole {
  owner
  editor
  viewer
}

// Поля Page, относящиеся к ACL (полная модель — в задаче Pages):
// projectId — принадлежность проекту (наследование доступа)
// parentId  — вложенность страниц
// published — публичный доступ (см. п.5)
// slug      — публичный адрес опубликованной страницы
```

### 4. Публикация (public read вне ACL)

PRD: «Публикация статей… приватность (скрыть/обновить)».

- На странице — флаг `published` + уникальный `slug`.
- Опубликованная страница читается **анонимно** через public-зону
  ([ADR-002](./002-routing-and-domains.md)), **в обход ACL** (read-only).
- Снять публикацию = скрыть (`published = false`).
- Отдельные share-link-токены на приватные страницы — позже.

### 5. Enforcement — policy-guard + декоратор

По аналогии с `JwtAuthGuard`, без внешних policy-библиотек:

```ts
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@RequireProjectRole('editor')
```

- `ProjectAccessGuard` достаёт `projectId` из ресурса (param/body/страница →
  проект), находит `ProjectMember` для `req.user.sub`, сравнивает роль с
  требуемой по иерархии. `owner` проходит любую проверку.
- Нет записи участника → `403` (единый shape `{ code, message }`, RFC-001; новый
  код `FORBIDDEN`).
- CASL/policy-движок — не сейчас; заведём отдельным ADR, если правила разрастутся.

## Альтернативы

| Вариант                                   | Почему отклонён                                                        |
| ----------------------------------------- | --------------------------------------------------------------------- |
| Ввести слой Workspace сразу               | PRD не требует; лишняя сущность в MVP. Обернём позже без миграции боли |
| ACL на каждой странице (page-level)       | Сложность; наследование от проекта покрывает почти все кейсы MVP       |
| Роль на члена воркспейса без per-project  | Нет приватности между проектами внутри команды                        |
| CASL / policy-engine                      | Overkill на текущем объёме правил; guard проще и тестируемее           |

## Последствия

- **Prisma**: новые `Project`, `ProjectMember`, enum `ProjectRole`; на `Page` —
  `projectId`, `parentId`, `published`, `slug`. Миграция в git.
- **apps/api**: `ProjectAccessGuard` + декоратор `@RequireProjectRole`, код ошибки
  `FORBIDDEN` в общий shape.
- **Инвайты участников** (по email/ссылке) — отдельный endpoint/UX; роли задаёт
  этот ADR, механику приглашения — нет.
- **Realtime**: в Yjs-комнату пускаем `editor` и выше; проверка доступа на
  установке соединения (следствие, деталь — в realtime-задаче, [ADR-006](./006-realtime.md)).
- **FE-3**: дерево проектов рисуется сейчас (read-only каркас), мутации/шеринг —
  после принятия этого ADR.
- **Публичная зона** читает `published`-страницы вне ACL ([ADR-002](./002-routing-and-domains.md)).

## Вне скоупа (дальше)

- Page-level override приватности
- Роль `commenter`
- Share-link токены на приватные страницы
- Слой Workspace (мульти-команда)
- Гранулярные права на уровне блоков

## Связанные документы

- [ADR-002](./002-routing-and-domains.md) — маршруты и public-зона
- [ADR-003](./003-authentication.md) — аутентификация
- [ADR-006](./006-realtime.md) — realtime, доступ в Yjs-комнату
- [RFC-001](../rfc/001-api-contract.md) — единый shape ошибок
