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
├── package.json
└── pnpm-workspace.yaml
```

> `apps/` и `packages/` будут созданы при инициализации. Сейчас репозиторий содержит документацию и конфигурацию корня.

## Документация

| Документ | Описание |
|----------|----------|
| [docs/README.md](./docs/README.md) | Индекс всей документации |
| [docs/product-requirements.md](./docs/product-requirements.md) | Продуктовые требования (из ТЗ) |
| [docs/adr/](./docs/adr/) | **Принятые** архитектурные решения |
| [docs/rfc/](./docs/rfc/) | Темы, требующие **дальнейшей проработки** |

### Ключевые принятые решения (ADR)

- Monorepo: `apps/web` + `apps/api` + `packages/shared`
- Маршруты: `/app/*` на `noto.app`, навигация `/app/[pageId]` (как Notion)
- Auth: access token в `localStorage`, refresh в HttpOnly cookie
- Данные: RSC на public, TanStack Query в `/app`
- State: URL → страница, Query → server state, Zustand → UI only, Yjs → контент редактора

Полный список: [docs/adr/README.md](./docs/adr/README.md)

### Открытые темы (RFC)

- Контракт API: OpenAPI vs tRPC
- Выбор rich-text редактора
- Yjs provider
- MVP scope, E2E, blog-поддомен

Полный список: [docs/rfc/README.md](./docs/rfc/README.md)

## Быстрый старт

> Monorepo в стадии инициализации. Apps ещё не созданы.

```bash
pnpm install          # после появления pnpm-workspace.yaml
pnpm dev              # запуск всех apps в dev-режиме
```

Подробные инструкции появятся в `apps/web/README.md` и `apps/api/README.md` после scaffold.

## Статус

| Этап | Статус |
|------|--------|
| Репозиторий и документация | ✅ |
| Архитектурные решения (ADR) | ✅ |
| RFC / открытые темы | 📝 Draft |
| Scaffold monorepo (`apps/`, `packages/`) | 🔲 |
| CI pipeline | 🔲 |
| Первый рабочий MVP | 🔲 |

## Процессы

- Trunk-based git, только PR с код-ревью
- Коммиты: [Conventional Commits](https://www.conventionalcommits.org/) (`feat(web): ...`, `fix(api): ...`)
- Ветки: `feat/short-description`, `fix/...`
- CI на каждый PR: lint, test, build, typecheck
- Релизы через GitHub Release + Docker

Подробнее: [ADR-009](./docs/adr/009-development-process.md)

## Лицензия

MIT — см. [LICENSE](./LICENSE).
