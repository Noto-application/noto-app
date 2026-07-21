# ADR-001: Структура monorepo

**Статус:** Accepted  
**Дата:** 2026-07-14  
**Обновлён:** 2026-07-21 — структура уточнена по факту scaffold'а (BE-1)

## Контекст

Проект разрабатывается командой на месяцы. Нужна единая кодовая база с общими типами между фронтендом и бэкендом, единым CI и документацией.

## Решение

Monorepo на **pnpm workspaces**:

```
noto-app/                    # корень репозитория
├── apps/
│   ├── web/                 # Next.js — фронтенд
│   └── api/                 # NestJS — бэкенд
├── packages/
│   └── shared/              # общие типы, утилиты, константы
├── docs/
│   ├── adr/                 # принятые архитектурные решения
│   ├── rfc/                 # темы на проработку
│   └── product-requirements.md
├── docker-compose.yml       # postgres + redis для локальной разработки
├── tsconfig.base.json       # общие compilerOptions для всех пакетов
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

### Правила

- **`packages/shared`** — общие TypeScript-типы и утилиты для `apps/web` и `apps/api`
- **`packages/ui`** — не создаём на старте; выносим при необходимости (см. [RFC-005](../rfc/005-supplementary-libraries.md))

- Документация и ADR — в корневом `docs/`, не внутри отдельных apps
- Пакетный менеджер: **pnpm**
- Имена пакетов — в скоупе `@noto/*` (`@noto/api`, `@noto/shared`)

### Task runner

Задачи в пакетах оркеструет **Turborepo** — см. [ADR-010](./010-task-runner.md).

## Альтернативы

| Вариант                                    | Почему отклонён                                       |
| ------------------------------------------ | ----------------------------------------------------- |
| Отдельные репозитории fe/be                | Сложнее синхронизировать типы, выше порог для команды |
| `frontend/` + `backend/` на верхнем уровне | Менее стандартно для pnpm/turborepo экосистемы        |
| `@noto/api-types` как npm-пакет            | Избыточно на старте учебного проекта                  |

## Последствия

- Нужен root `pnpm-workspace.yaml` и скрипты `pnpm --filter`
- Shared types живут в `packages/shared` до выбора codegen (см. [RFC-001](../rfc/001-api-contract.md))
- CI должен уметь билдить и тестировать каждый app отдельно
- Версия Node фиксируется в `.nvmrc` и `engines`, версия pnpm — в `packageManager`
