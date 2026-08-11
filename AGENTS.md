# AGENTS.md

Правила для AI-ассистентов (Claude Code, Cursor, Codex) в репозитории Noto.

Этот файл — краткая выжимка принятых решений. Развёрнутые обоснования — в
[`docs/adr/`](docs/adr/) и [`docs/rfc/`](docs/rfc/); ссылки ведут к первоисточнику.
`CLAUDE.md` — симлинк на этот файл.

> Правила ниже отражают **принятые** ADR. Там, где решение ещё в статусе Draft
> (RFC), это отмечено явно — не считай такое окончательным.

## Что за проект

Noto — лёгкая современная альтернатива Notion для заметок, документации и
проектов. Monorepo на pnpm workspaces + Turborepo. Учебный командный проект,
рассчитан на месяцы разработки.

## Структура monorepo

См. [ADR-001](docs/adr/001-monorepo-structure.md), [ADR-010](docs/adr/010-task-runner.md).

- `apps/api` — NestJS (бэкенд)
- `apps/web` — Next.js App Router (фронтенд)
- `packages/shared` — общие типы, утилиты, константы
- Имена пакетов в скоупе `@noto/*` (`@noto/api`, `@noto/shared`)
- Задачи оркеструет Turborepo. Каждый пакет объявляет из общего набора
  `dev`/`build`/`lint`/`test`/`typecheck` те скрипты, что реально есть.
  Скрипты-заглушки (`echo ... && exit 0`) запрещены — дают в CI ложный зелёный.
- Node 24, pnpm 11 (запинены в `.nvmrc`, `engines`, `packageManager`).
  Пакетный менеджер — только pnpm, не npm/yarn.

## Границы состояния (frontend)

См. [ADR-005](docs/adr/005-state-management.md). **Самое частое место ошибок —
соблюдай матрицу строго.**

| Слой            | Что хранит                                                                    |
| --------------- | ----------------------------------------------------------------------------- |
| URL             | Навигация, текущая страница (`/app/[pageId]`)                                 |
| TanStack Query  | Server state: проекты, метаданные страниц, поиск, корзина, история, настройки |
| Zustand         | **Только UI**: сайдбар, модалки, тема, размеры панелей                        |
| Yjs + BlockNote | **Только контент** редактора при collaborative editing                        |

- Контент редактора не дублировать в Query/Zustand
- `pageId`/`projectId` — в URL, не в Zustand
- Черновики форм — локальный state React Hook Form, не Zustand

## Маршруты и данные

См. [ADR-002](docs/adr/002-routing-and-domains.md), [ADR-004](docs/adr/004-data-fetching.md).

- Public-зона `(public)` (лендинг, `/login`, `/register`, SEO-статьи) — RSC,
  **без TanStack Query**
- Приватная `/app/*` — Client Components + TanStack Query
- URL-first навигация: переход по сайдбару всегда меняет URL на `/app/[pageId]`
- Server Actions для мутаций не используем — REST + Query

## Feature-Sliced Design (frontend)

См. [ADR-008](docs/adr/008-fsd-structure.md).

- Слои: `app → pages → widgets → features → entities → shared`
- Импорт только «вниз» по слоям
- `packages/shared` (уровень monorepo) ≠ FSD `shared` (уровень app) — не путать

## API-контракт

См. [ADR-012](docs/adr/012-api-contract.md). **Принято.**

- REST + ts-rest, контракты в `packages/shared` как source of truth,
  валидаторы на Zod (типы и runtime из одного определения)
- Единый shape ошибок `{ code, message, details? }`, `code` — enum
- Бэкенд: `@ts-rest/nest` + Fastify, роутинг на контроллерах (не `routes.ts`)
- OpenAPI/Swagger — по потребности через `@ts-rest/open-api`, сейчас не строим

## Аутентификация

См. [ADR-003](docs/adr/003-authentication.md).

- Access и refresh токены — **оба в HttpOnly cookie**, не в localStorage
- Запросы в `/app` — с `credentials: 'include'`
- CORS с `credentials: true`; wildcard `*` в origin запрещён

## Тесты

См. [ADR-007](docs/adr/007-tech-stack.md), [ADR-009](docs/adr/009-development-process.md).

- `apps/api` — Jest (unit + e2e)
- `apps/web` — Vitest + React Testing Library
- E2E — Playwright
- Покрывать хотя бы основную функциональность

## Git и коммиты

См. [ADR-009](docs/adr/009-development-process.md).

- [Conventional Commits](https://www.conventionalcommits.org/) на английском
- `scope` обязателен для кода: `web` / `api` / `shared` / `docs` / `root`
- `description` — императив, lowercase, без точки в конце
- Trunk-based; прямой push в `main` запрещён, только PR с код-ревью
- **Одна задача = один PR = один мёрдж.** Ветку заводи **от задачи** (linked
  branch), PR связывай `Closes #N` (не `Refs`, не прозой). Крупную задачу дроби
  на подзадачи, а не на несколько PR под одну issue.

## Порядок работы над фичей

См. [ADR-013](docs/adr/013-spec-driven-development.md), [docs/specs/](docs/specs/).
Spec-Driven + Test-First: для значимой фичи сначала спецификация, затем тесты,
затем код.

| Масштаб                   | Процесс                                      |
| ------------------------- | -------------------------------------------- |
| Значимая фича             | Spec (`docs/specs/`) → тесты → код           |
| Обычный модуль / эндпоинт | Тест-первым; spec — пара строк в описании PR |
| Багфикс, вёрстка, мелочь  | Тест где осмысленно; spec не нужен           |

- Spec описывает **поведение и контракт**, не реализацию. Шаблон —
  [`docs/specs/_template.md`](docs/specs/_template.md).
- **Spec живёт рядом с кодом**: `<name>.spec.md` в папке модуля/слайса
  (например `apps/api/src/auth/auth.spec.md`). `docs/specs/` — только реестр
  ([REGISTRY.md](docs/specs/REGISTRY.md)) и кросс-модульные спеки.
- Тест-первым — на логику (сервисы, валидаторы, хуки, стор), не на разметку и не
  на CRDT/realtime и внешние интеграции (там спайк, тесты потом).
- **Тест ревьюит человек до написания кода.** Не пиши тест и код за один проход
  под одну задачу — тест выродится в тавтологию.

## Стоп-лист — чего делать нельзя

- **Не коммить, не пушь, не создавай и не меняй PR/issue без явного
  подтверждения человека.** Готовь изменения, показывай, жди «да».
- **Имена веток — только латиницей** (`feat/short-description`, `fix/...`).
  Кириллица запрещена.
- Не выдавай Draft-RFC за принятое решение
- Не создавай состояние вне матрицы [ADR-005](docs/adr/005-state-management.md)
- Не меняй запиненные версии зависимостей без причины
  (например, TypeScript запинен на 5.9 — typescript-eslint и ts-jest не
  поддерживают TS 7)
- Код и коммиты — на английском; документация и комментарии — на русском

## Расширение

Специфика приложений — во вложенных `AGENTS.md`, которые дополняют этот:

- `apps/api/AGENTS.md` — NestJS: модули, DI, слои, валидация, ошибки
- `apps/web/AGENTS.md` — Next.js, FSD, BlockNote
