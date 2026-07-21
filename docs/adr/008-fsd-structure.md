# ADR-008: Feature-Sliced Design

**Статус:** Accepted  
**Дата:** 2026-07-14

## Контекст

Командная разработка на месяцы требует предсказуемой структуры кода. ТЗ рекомендует FSD; нужен баланс между строгостью и скоростью старта.

## Решение

### Структура `apps/web/src/`

```
src/
├── app/          # Next.js App Router: routes, layouts, providers
├── pages/        # FSD: композиция страниц (опционально поверх app/)
├── widgets/      # Крупные UI-блоки: sidebar, editor-layout, calendar-widget
├── features/     # Пользовательские действия: auth, create-project, publish-article, trash
├── entities/     # Бизнес-сущности: project, page, user, comment
└── shared/       # UI kit, api, lib, config, types
```

### Правила слоёв

| Слой       | Импортирует из                             | Не импортирует                |
| ---------- | ------------------------------------------ | ----------------------------- |
| `app`      | pages, widgets, features, entities, shared | —                             |
| `pages`    | widgets, features, entities, shared        | app                           |
| `widgets`  | features, entities, shared                 | pages, app                    |
| `features` | entities, shared                           | widgets, pages, app           |
| `entities` | shared                                     | features, widgets, pages, app |
| `shared`   | —                                          | всё выше                      |

### Стартовая упрощённая схема

На первых спринтах допустимо:

```
src/
├── app/
├── features/
└── shared/
```

Полный FSD (`widgets`, `entities`, `pages`) — по мере роста кодовой базы.

## Последствия

- Редактор — отдельный крупный widget/feature (`widgets/editor` или `features/editor`)
- `packages/shared` не заменяет FSD `shared` — разные уровни (monorepo vs app)

## Связанные документы

- [ADR-001](./001-monorepo-structure.md)
- [ADR-007](./007-tech-stack.md)
