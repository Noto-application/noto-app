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

### Требования

- macOS, Linux или WSL2. Нативный Windows launcher не поддерживает — используйте WSL2 (ниже).
- Node.js 24 (`nvm use`) и pnpm 11 (`corepack enable`).
- Docker с работающим daemon и Compose plugin с поддержкой `up --wait --wait-timeout`
  (Docker Desktop или Docker Engine + актуальный Compose plugin).
- Caddy в `PATH` на том же хосте, где запускается Node: на macOS `brew install caddy`,
  на Linux — [официальная установка Caddy](https://caddyserver.com/docs/install).
- Свободные порты приложений `3000`, `4000`, `5555` и прокси `8080`;
  Compose использует `5433` для Postgres и `6380` для Redis.

### Первый запуск

Все команды — из корня репозитория. Копирование примеров выполняйте **только для
отсутствующих файлов**, не поверх личных настроек.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/collab/.env.example apps/collab/.env
```

Проверьте настройки единого origin (launcher не исправляет `.env` автоматически):

| Файл                  | Настройки для `pnpm dev`                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/.env`       | `PORT=4000`, `HOST=127.0.0.1`, `CORS_ORIGIN=http://localhost:8080`; непустые `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COLLAB_SHARED_SECRET` |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:8080` (literal URL, без `$VAR`)                                                                                                       |
| `apps/collab/.env`    | `PORT=5555`, `COLLAB_ALLOWED_ORIGINS=http://localhost:8080`, `API_INTERNAL_URL=http://localhost:4000`, непустой `COLLAB_SHARED_SECRET`, совпадающий с API                   |

Значения подключения к локальным Postgres/Redis — в API-примере. Проверьте их перед
миграциями: `db:deploy` работает с вашей эффективной `DATABASE_URL`.
Переменные родительского shell приоритетнее файлов; для Next также учитываются
`.env.development.local`, `.env.local`, `.env.development`, `.env` в этом порядке.
`NODE_ENV` должен быть `development`; не экспортируйте общий `PORT` — API, web и
collab используют разные порты. Для запуска через launcher Turbo сохраняет shell
overrides (`TURBO_ENV_MODE=loose`), но env-файлы разных приложений не смешиваются.

```bash
pnpm dev
```

Одна команда проверяет окружение, CLI и Docker daemon, запускает существующие
Postgres/Redis через Compose с ожиданием healthcheck (до 60 секунд), применяет
**только существующие** миграции (`pnpm --filter @noto/api db:deploy`), затем
запускает Caddy foreground и приложения через `turbo run dev`.
Ошибка любого шага останавливает запуск; ошибка/любой выход Caddy или Turbo
останавливает второй процесс. Образы при первом запуске могут скачиваться;
если запуск Compose превысил общий предел 90 секунд, проверьте сеть и повторите.

Откройте **[http://localhost:8080](http://localhost:8080)** после готовности приложений
в логах. Через этот origin идут фронт, `/api/*` и WebSocket `/collab`.
`/internal/*` в API не проксируется. API health доступен напрямую:

```bash
curl http://localhost:4000/health
```

### Повторный запуск и остановка

Снова выполните `pnpm dev`: уже работающие Postgres/Redis переиспользуются,
`db:deploy` проверит и применит ещё не применённые миграции.
При обычном `Ctrl+C` или `SIGTERM` launcher передаёт сигнал напрямую установленному
native Turbo, который штатно останавливает свои task groups. Stdout/stderr Turbo
передаются через pipes (non-TTY); в этом режиме Turbo принудительно завершает
неответившие задачи после своего 10-секундного ожидания. Затем launcher
останавливает собственный Caddy. Код штатного завершения — 130/143.
Проверки и стартовые команды отдельно останавливаются по собственным process groups:
SIGTERM, до 10 секунд ожидания, затем SIGKILL оставшимся собственным группам.

**Ограничение аварийного случая:** crash/SIGKILL Turbo или зависание его shutdown
дольше внешнего watchdog (15 секунд) могут оставить процессы приложений работающими.
Launcher завершает собственный Caddy/стартовые команды, возвращает ошибку (код 1)
и предупреждает `application processes may still be running`. Он не является
supervisor и не убивает процессы по имени или порту: проверьте оставшуюся свою
сессию вручную. SIGKILL самого launcher тоже не даёт гарантии cleanup.
Контейнеры Postgres/Redis, volumes и данные остаются; чужие процессы не завершаются.
Launcher не запускает `migrate dev`, reset, Compose down и удаление данных.
Одновременная остановка API и collab **не гарантирует** финальный flush редактора.

Caddy запускается с `admin off` и `persist_config off`: нет обращения к чужому
admin endpoint и записи autosave. Поэтому `caddy stop` / `caddy reload` для этой
сессии **не применимы**. После изменения Caddyfile остановите `pnpm dev` и запустите
снова; не используйте `caddy start` / `resume` параллельно с launcher.

### Только приложения и миграции

`pnpm dev:apps` — прежний `turbo run dev`, **без** проверок, Docker, миграций и Caddy.
Инфраструктуру, окружение и прокси в этом режиме подготовьте самостоятельно.
Для полного локального сценария используйте `pnpm dev`, а не `dev:apps`.

Создание миграции — отдельное осознанное действие разработчика после изменения
Prisma schema: `pnpm --filter @noto/api db:migrate`. Применение существующих вручную:
`pnpm --filter @noto/api db:deploy`. Ошибку deploy разбирайте по логам Prisma;
launcher не предлагает и не выполняет автоматический reset.

### Устранение проблем

- **Env отсутствует / ключ пустой / настройки несовместимы:** скопируйте нужный
  пример только в отсутствующий файл; поправьте указанный ключ и shell override.
  Старые `CORS_ORIGIN` / `NEXT_PUBLIC_API_URL` с `3000` / `4000` замените на origin
  `http://localhost:8080`. Значения секретов launcher не печатает.
- **CLI не найден:** установите Caddy/Docker Compose и проверьте `PATH` в том же
  терминале. `caddy version`, `docker compose version` и `docker info` должны работать.
- **Native Turbo не найден:** выполните `pnpm install` на текущей платформе с
  optional dependencies. Launcher ищет binary относительно установленного пакета
  Turbo, без npm fallback, автоматической установки и эмуляции другой архитектуры.
- **Docker недоступен:** запустите Docker Desktop/daemon, проверьте Docker context
  и права на socket. **Health timeout:** `docker compose ps` и
  `docker compose logs postgres redis`; проверьте порты `5433`/`6380`.
- **Порт занят:** проверьте владельца (`lsof -nP -iTCP:8080 -sTCP:LISTEN` на macOS,
  `ss -ltnp` на Linux), аналогично `3000`, `4000`, `5555`. Остановите свою прежнюю
  сессию вручную. Launcher не убивает владельца и не останавливает чужой Caddy.
  Проверка портов не исключает гонку — поздний конфликт виден в логах Caddy/Turbo.
- **Ошибка миграций:** проверьте подключение и состояние миграций; исправьте причину
  и повторите `pnpm dev`. Приложения и прокси до успешного deploy не запускаются.
- **502 сразу после старта:** дождитесь готовности API/Next/collab в логах;
  напечатанный URL не является проверкой readiness.

### Windows: WSL2

Установите WSL2 с Linux-дистрибутивом и Docker Desktop, включите
**Settings → Resources → WSL Integration** для этого дистрибутива.
Внутри WSL установите Node 24, pnpm 11 и Linux-версию Caddy. Команды запускайте
в WSL-терминале, не PowerShell/cmd. Проверьте там `node --version`, `pnpm --version`,
`caddy version`, `docker compose version`, `docker info`.
Клонируйте репозиторий в Linux filesystem, например `~/projects/noto-app`,
**не** в `/mnt/c`: это важно для watch-режима и скорости файловых операций.
Затем выполните обычный первый запуск выше. В браузере Windows ожидается доступ
к `http://localhost:8080` через localhost forwarding WSL2; реальная проверка WSL2
пока **UNVERIFIED**. Если адрес недоступен, проверьте localhost forwarding,
firewall/VPN и сначала доступ из WSL (`curl http://localhost:8080`).

Задачи monorepo идут через Turborepo:

| Команда                                           | Что делает                                              |
| ------------------------------------------------- | ------------------------------------------------------- |
| `pnpm dev`                                        | безопасный локальный запуск: DB → deploy → Caddy + apps |
| `pnpm dev:apps`                                   | только `turbo run dev`                                  |
| `pnpm build`                                      | сборка с учётом графа зависимостей                      |
| `pnpm lint`                                       | ESLint                                                  |
| `pnpm test`                                       | тесты                                                   |
| `pnpm typecheck`                                  | `tsc --noEmit`                                          |
| `pnpm format`                                     | Prettier                                                |
| `pnpm docker:up` / `docker:down` / `docker:reset` | Postgres + Redis                                        |

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
