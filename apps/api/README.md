# @noto/api

Бэкенд Noto на NestJS.

## Требования

- Node.js 24 (`nvm use` подхватит `.nvmrc` в корне)
- pnpm 11 (`corepack enable`)
- Docker + Docker Compose

## Локальный запуск

Все команды — из **корня репозитория**.

```bash
pnpm install                        # зависимости всего monorepo
docker compose up -d                # postgres:5433, redis:6380
cp apps/api/.env.example apps/api/.env
pnpm dev                            # turbo поднимет все apps в watch-режиме
```

Только API, без остальных приложений:

```bash
pnpm --filter @noto/api dev
```

Проверка:

```bash
curl http://localhost:4000/health
# {"status":"ok","uptime":3,"timestamp":"..."}
```

## Скрипты

| Команда                             | Что делает                       |
| ----------------------------------- | -------------------------------- |
| `pnpm --filter @noto/api dev`       | `nest start --watch`             |
| `pnpm --filter @noto/api build`     | сборка в `dist/`                 |
| `pnpm --filter @noto/api start`     | запуск собранного `dist/main.js` |
| `pnpm --filter @noto/api lint`      | ESLint по `src` и `test`         |
| `pnpm --filter @noto/api typecheck` | `tsc --noEmit`                   |
| `pnpm --filter @noto/api test`      | unit-тесты (Jest)                |
| `pnpm --filter @noto/api test:e2e`  | e2e-тесты (Jest + supertest)     |

Из корня те же задачи запускаются на весь monorepo: `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm typecheck`.

## Маршруты

Глобальный префикс — `/api`. Исключение: `GET /health` живёт в корне, потому что
его дёргают healthcheck'и Docker и оркестратора, которые про префикс не знают.

| Метод | Путь      | Описание                                  |
| ----- | --------- | ----------------------------------------- |
| GET   | `/health` | Liveness: `status`, `uptime`, `timestamp` |

Проверки БД и Redis в `/health` пока нет — подключим вместе с ORM (BE-2).

## Переменные окружения

Файл `apps/api/.env`, шаблон — `.env.example`. Схема и валидация:
[`src/config/env.schema.ts`](./src/config/env.schema.ts). Значения проверяются
на старте через Zod: при отсутствии или неверном формате приложение падает
сразу, а не на первом запросе.

| Переменная     | Обяз.  | Дефолт                  | Назначение                                                    |
| -------------- | ------ | ----------------------- | ------------------------------------------------------------- |
| `NODE_ENV`     | нет    | `development`           | Режим работы                                                  |
| `PORT`         | нет    | `4000`                  | Порт HTTP-сервера                                             |
| `CORS_ORIGIN`  | нет    | `http://localhost:3000` | Origin фронтенда; wildcard нельзя, запросы идут с credentials |
| `DATABASE_URL` | **да** | —                       | Строка подключения к Postgres                                 |
| `REDIS_URL`    | нет    | —                       | Строка подключения к Redis                                    |

## Docker Compose

`docker-compose.yml` в корне репозитория.

| Сервис   | Образ                | Порт на хосте |
| -------- | -------------------- | ------------- |
| postgres | `postgres:16-alpine` | `5433`        |
| redis    | `redis:7-alpine`     | `6380`        |

Порты нестандартные намеренно — чтобы не конфликтовать с локально
установленными Postgres/Redis.

```bash
docker compose up -d      # поднять
docker compose ps         # статус и healthcheck
docker compose down       # остановить
docker compose down -v    # остановить и стереть данные
```

## Структура

```
apps/api/
├── src/
│   ├── config/
│   │   └── env.schema.ts      # Zod-схема + валидация env на старте
│   ├── health/
│   │   ├── health.controller.ts
│   │   ├── health.service.ts
│   │   ├── health.service.spec.ts
│   │   └── health.module.ts
│   ├── app.module.ts
│   └── main.ts                # bootstrap, глобальный префикс, CORS
├── test/
│   ├── health.e2e-spec.ts
│   └── jest-e2e.json
└── .env.example
```

## Связанные документы

- [ADR-003](../../docs/adr/003-authentication.md) — аутентификация, cookie, CORS
- [ADR-007](../../docs/adr/007-tech-stack.md) — стек
- [ADR-009](../../docs/adr/009-development-process.md) — процессы и CI
- [RFC-001](../../docs/rfc/001-api-contract.md) — контракт API
