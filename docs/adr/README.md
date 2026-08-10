# Architecture Decision Records (ADR)

Формат записей:

- **Статус:** Accepted — решение принято командой
- Каждый ADR самодостаточен и не требует чтения остальных, но ссылается на связанные RFC при необходимости

## Индекс

| ID                                  | Название                            | Статус   |
| ----------------------------------- | ----------------------------------- | -------- |
| [001](./001-monorepo-structure.md)  | Структура monorepo                  | Accepted |
| [002](./002-routing-and-domains.md) | Маршруты, домены, навигация         | Accepted |
| [003](./003-authentication.md)      | Аутентификация                      | Accepted |
| [004](./004-data-fetching.md)       | Загрузка данных                     | Accepted |
| [005](./005-state-management.md)    | State management                    | Accepted |
| [006](./006-realtime.md)            | Realtime                            | Accepted |
| [007](./007-tech-stack.md)          | Технологический стек                | Accepted |
| [008](./008-fsd-structure.md)       | FSD                                 | Accepted |
| [009](./009-development-process.md) | Процессы разработки, коммиты, ветки | Accepted |
| [010](./010-task-runner.md)         | Task runner — Turborepo             | Accepted |
| [011](./011-authorization-acl.md)   | Авторизация и модель доступа (ACL)   | Accepted |

Новый ADR получает следующий свободный номер в момент принятия. Номера заранее
не резервируются: RFC ссылается на будущий ADR словами, а не номером.
