# Noto

Monorepo проекта **Noto** — лёгкой современной альтернативы Notion для заметок, документации и проектов.

Репозиторий: [github.com/Noto-application/noto-app](https://github.com/Noto-application/noto-app)

## Структура репозитория

```
noto-app/
├── apps/
│   ├── web/          # Next.js — фронтенд (noto.app)
│   └── api/          # NestJS — бэкенд
├── packages/
│   └── shared/       # общие типы, утилиты, константы
├── docs/
│   ├── adr/          # принятые архитектурные решения
│   ├── rfc/          # темы на проработку
│   └── product-requirements.md
├── docker-compose.yml
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

## Документация

| Документ                                                       | Описание                                  |
| -------------------------------------------------------------- | ----------------------------------------- |
| [docs/README.md](./docs/README.md)                             | Индекс всей документации                  |
| [docs/product-requirements.md](./docs/product-requirements.md) | Продуктовые требования (из ТЗ)            |
| [docs/adr/](./docs/adr/)                                       | **Принятые** архитектурные решения        |
| [docs/rfc/](./docs/rfc/)                                       | Темы, требующие **дальнейшей проработки** |

### Ключевые принятые решения (ADR)

- Monorepo: `apps/web` + `apps/api` + `packages/shared` на pnpm workspaces
- Task runner: Turborepo — граф задач и кэш для CI
- Маршруты: `/app/*` на `noto.app`, навигация `/app/[pageId]` (как Notion)
- Auth: access и refresh токены — оба в HttpOnly cookie
- Данные: RSC на public, TanStack Query в `/app`
- State: URL → страница, Query → server state, Zustand → UI only, Yjs → контент редактора

Полный список: [docs/adr/README.md](./docs/adr/README.md)

### Открытые темы (RFC)

- Контракт API: направление — REST + ts-rest + shared contracts, ждёт спайка
- Выбор rich-text редактора
- Yjs provider
- MVP scope, E2E, blog-поддомен

Полный список: [docs/rfc/README.md](./docs/rfc/README.md)

## Быстрый старт

Нужны Node.js 24 (`nvm use`), pnpm 11 (`corepack enable`) и Docker.

```bash
pnpm install                          # зависимости всего monorepo
docker compose up -d                  # postgres:5433, redis:6380
cp apps/api/.env.example apps/api/.env
pnpm dev                              # все apps в watch-режиме

curl http://localhost:4000/health     # {"status":"ok",...}
```

Задачи monorepo идут через Turborepo:

| Команда                                           | Что делает                         |
| ------------------------------------------------- | ---------------------------------- |
| `pnpm dev`                                        | dev-режим во всех пакетах          |
| `pnpm build`                                      | сборка с учётом графа зависимостей |
| `pnpm lint`                                       | ESLint                             |
| `pnpm test`                                       | тесты                              |
| `pnpm typecheck`                                  | `tsc --noEmit`                     |
| `pnpm format`                                     | Prettier                           |
| `pnpm docker:up` / `docker:down` / `docker:reset` | Postgres + Redis                   |

Один пакет: `pnpm --filter @noto/api <script>` или `pnpm --filter web <script>`.

Подробнее по бэкенду — [apps/api/README.md](./apps/api/README.md).
Подробнее по фронтенду — [apps/web/README.md](./apps/web/README.md).

## Статус

| Этап                                              | Статус   |
| ------------------------------------------------- | -------- |
| Репозиторий и документация                        | ✅       |
| Архитектурные решения (ADR)                       | ✅       |
| RFC / открытые темы                               | 📝 Draft |
| Scaffold monorepo (`apps/api`, `packages/shared`) | ✅       |
| Scaffold `apps/web`                               | ✅       |
| CI pipeline                                       | 🔲       |
| Первый рабочий MVP                                | 🔲       |

## Процессы

- Trunk-based git, только PR с код-ревью
- Коммиты: [Conventional Commits](https://www.conventionalcommits.org/) (`feat(web): ...`, `fix(api): ...`)
- Ветки: `feat/short-description`, `fix/...`
- CI на каждый PR: lint, test, build, typecheck
- Релизы через GitHub Release + Docker

Подробнее: [ADR-009](./docs/adr/009-development-process.md)

## Лицензия

MIT — см. [LICENSE](./LICENSE).
