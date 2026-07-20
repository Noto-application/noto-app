# Документация Noto

| Раздел | Описание |
|--------|----------|
| [adr/](./adr/) | Принятые архитектурные решения (ADR) |
| [rfc/](./rfc/) | Темы на проработку (RFC) |
| [product-requirements.md](./product-requirements.md) | Продуктовые требования и функциональность (из ТЗ) |

## ADR — принятые решения

| ID | Название |
|----|----------|
| [ADR-001](./adr/001-monorepo-structure.md) | Структура monorepo |
| [ADR-002](./adr/002-routing-and-domains.md) | Маршруты, домены, навигация |
| [ADR-003](./adr/003-authentication.md) | Аутентификация и защита `/app` |
| [ADR-004](./adr/004-data-fetching.md) | Загрузка данных (RSC vs TanStack Query) |
| [ADR-005](./adr/005-state-management.md) | Границы URL / Query / Zustand / Yjs |
| [ADR-006](./adr/006-realtime.md) | Realtime: Yjs vs Socket.io |
| [ADR-007](./adr/007-tech-stack.md) | Технологический стек |
| [ADR-008](./adr/008-fsd-structure.md) | Feature-Sliced Design |
| [ADR-009](./adr/009-development-process.md) | Процессы разработки, CI/CD, коммиты, ветки |

## RFC — на проработку

| ID | Название |
|----|----------|
| [RFC-001](./rfc/001-api-contract.md) | Контракт API: REST + ts-rest + shared contracts |
| [RFC-002](./rfc/002-rich-text-editor.md) | Выбор rich-text редактора |
| [RFC-003](./rfc/003-yjs-provider.md) | Yjs provider для collaborative editing |
| [RFC-004](./rfc/004-blog-subdomain.md) | Вынос публичных статей на `blog.noto.app` |
| [RFC-005](./rfc/005-supplementary-libraries.md) | Календарь, upload, поиск |
| [RFC-006](./rfc/006-e2e-testing.md) | E2E-стратегия |
| [RFC-007](./rfc/007-mvp-scope.md) | Scope первого релиза |
