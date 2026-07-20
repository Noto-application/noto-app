# ADR-007: Технологический стек

**Статус:** Accepted  
**Дата:** 2026-07-14

## Контекст

ТЗ задаёт базовый стек для prod-разработки. Команда может менять детали, но инструментарий должен покрывать все сферы: UI, API, realtime, инфраструктура, качество кода.

## Решение

### Frontend — `apps/web`

| Категория | Технология |
|-----------|------------|
| Framework | Next.js (App Router) |
| Язык | TypeScript |
| Server state | TanStack Query |
| Client state | Zustand |
| UI | shadcn/ui + Tailwind CSS |
| Формы | React Hook Form + Zod |
| Realtime transport | Socket.io (клиент) |
| Архитектура | Feature-Sliced Design |
| Пакетный менеджер | pnpm |

#### Инструменты разработки (frontend)

- ESLint, Prettier, Husky
- Vitest + React Testing Library
- Storybook (UI-компоненты)
- Sentry / Glitchtip (ошибки на фронте; Glitchtip — альтернатива, API совместим с Sentry)

### Backend — `apps/api`

| Категория | Технология |
|-----------|------------|
| Framework | NestJS |
| Язык | TypeScript |
| БД | PostgreSQL |
| Кэш / очереди | Redis, BullMQ |
| ORM | Prisma или TypeORM |
| API docs | контракты (shared contracts) + опциональная генерация Swagger/OpenAPI |
| Realtime | Socket.io |
| Файлы | S3-совместимое хранилище |
| ИИ | OpenAI API (npm-пакет `openai`) |

#### Инструменты разработки (backend)

- ESLint, Prettier, Husky
- Docker (локальная разработка и продакшн)

### Продакшн-инфраструктура (из ТЗ)

- Docker, контейнеризация обязательна
- Несколько инстансов в проде
- Логирование: **Loki** + Promtail
- Метрики: **Prometheus**, Grafana, node_exporter, cAdvisor
- Переменные окружения: `.env` + GitHub Secrets

### Shared — `packages/shared`

- Общие TypeScript-типы, константы, утилиты
- Стратегия синхронизации с API — [RFC-001](../rfc/001-api-contract.md)

## Принципы

- Стек можно менять под задачи команды, если сохраняется нужный инструментарий
- Обязательно писать тесты хотя бы на основной функционал
- Минимум кастомных стилей — через UI kit (shadcn)

## Связанные документы

- [ADR-008](./008-fsd-structure.md)
- [ADR-009](./009-development-process.md)
- [RFC-005](../rfc/005-supplementary-libraries.md) — календарь, upload, поиск
