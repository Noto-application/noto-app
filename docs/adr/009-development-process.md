# ADR-009: Процессы разработки, CI/CD и качество кода

**Статус:** Accepted  
**Дата:** 2026-07-14

## Контекст

ТЗ требует prod-подход: тесты, линтинг, код-ревью, CI, trunk-based git, контейнеризация, документация.

## Решение

### Качество кода

- **Линтинг обязателен** — ESLint + Prettier на fe и be
- **FSD-линтер** — правила соблюдения слоёв на фронте
- **Код-ревью на каждую задачу** — перекрёстное, не только тимлид
- **Тесты** — хотя бы на основной функционал:
  - Frontend: Vitest + React Testing Library
  - E2E: см. [RFC-006](../rfc/006-e2e-testing.md)
- **Storybook** — UI-компоненты shadcn-обёрток и форм
- **Минимум кастомных стилей** — через разработанный UI kit

### CI/CD (на каждый Pull Request)

- ESLint
- Тесты (unit/integration)
- Build проекта
- Typecheck (`tsc`)

### Git workflow

- **Trunk-based development**
- Прямой push в `main` / `dev` / `trunk` — **запрещён**
- Только через PR с код-ревью
- **Релизы:** отведение ветки + GitHub Release (одна кнопка)

### Именование коммитов

Формат — **[Conventional Commits](https://www.conventionalcommits.org/)** на английском:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Правила:**

- `type` и `description` — обязательны; `scope` — обязателен для изменений в коде apps/packages
- `description` — в императиве, lowercase, без точки в конце (`add`, `fix`, `update` — не `added` / `fixes`)
- Одна логическая единица изменений = один коммит (или несколько связанных коммитов в одном PR)
- Breaking changes — через `!` после type/scope или footer `BREAKING CHANGE:`

**Типы:**

| Type | Когда |
|------|--------|
| `feat` | Новая функциональность |
| `fix` | Исправление бага |
| `docs` | Только документация |
| `style` | Форматирование, без смены логики |
| `refactor` | Рефакторинг без смены поведения |
| `perf` | Улучшение производительности |
| `test` | Добавление или правка тестов |
| `build` | Сборка, зависимости, Docker |
| `ci` | CI/CD пайплайны |
| `chore` | Прочее (не попадающее в типы выше) |
| `revert` | Откат коммита |

**Scopes (monorepo):**

| Scope | Область |
|-------|---------|
| `web` | `apps/web` |
| `api` | `apps/api` |
| `shared` | `packages/shared` |
| `docs` | `docs/` |
| `root` | корневые конфиги (`pnpm-workspace`, root `package.json` и т.п.) |

Несколько областей в одном коммите — перечислить через запятую: `feat(web,shared): ...`. Если изменение действительно кросс-cutting и scope размыт — допустим `feat: ...` без scope, но лучше дробить.

**Примеры:**

```
feat(web): add page sidebar navigation
fix(api): refresh token cookie path for /auth
docs(adr): add commit message convention
ci(root): run typecheck on pull requests
refactor(shared): extract PageId branded type
feat(web)!: remove legacy /projects/:id routes
```

**Ограничение длины:** subject (первая строка) ≤ 72 символа.

Проверка через commitlint + Husky — при инициализации monorepo (см. [ADR-007](./007-tech-stack.md)).

### Именование веток

```
<type>/<short-description>
```

или с тикетом (когда появится трекер):

```
<type>/<ticket>-<short-description>
```

- `type` — те же, что у коммитов: `feat`, `fix`, `docs`, `ci`, `chore`, `refactor`, `test`
- `short-description` — kebab-case, на английском
- Без пробелов и uppercase

**Примеры:**

```
feat/page-sidebar
fix/auth-refresh-cookie
docs/commit-convention
feat/NO-42-publish-article
```

### Деплой

- **Docker** обязателен — локально и в проде
- Контейнеризация при каждом деплое
- Релиз в прод — легко и удобно, «1 нажатием» в GitHub

### Документация

- Запуск проекта, переменные окружения, особенности — в `docs/`
- ADR для принятых решений, RFC для открытых тем
- `.env.example` в каждом app при инициализации

### Командные практики (из ТЗ)

- Еженедельный отчёт в пятницу (gap даже если маленький)
- Декомпозиция на параллельные блоки на доске задач
- Организатор проекта (Ulbi TV) — верхнеуровневый советчик, не ментор по каждой строке кода

## Переменные окружения (ожидаемые группы)

Будут описаны в `.env.example` после инициализации apps:

**`apps/web`:**

- URL API бэкенда
- Socket.io endpoint
- Sentry / Glitchtip DSN
- Публичный URL приложения (SEO, OG-теги)

**`apps/api`:**

- Database URL, Redis URL
- JWT secrets, cookie settings
- S3 credentials
- OpenAI API key

## Связанные документы

- [RFC-006](../rfc/006-e2e-testing.md)
- [RFC-007](../rfc/007-mvp-scope.md)
