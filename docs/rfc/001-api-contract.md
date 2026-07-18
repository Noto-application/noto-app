# RFC-001: Контракт API — OpenAPI vs tRPC

**Статус:** Draft  
**Дата:** 2026-07-14

## Контекст

Monorepo с `apps/web`, `apps/api`, `packages/shared`. Нужен способ синхронизации типов между фронтом и бэкендом. В ТЗ указаны NestJS + Swagger. Команда рассматривает также tRPC.

**Решение отложено** — требуется изучение и отдельный ADR после выбора.

## Варианты

### A. OpenAPI + codegen (orval)

Генерация TypeScript-типов и React Query hooks из `swagger.json` NestJS.

**Плюсы:**

- Уже в ТЗ: Swagger на NestJS
- Явный контракт — `swagger.json` как source of truth
- Слабая связность fe/be — удобно при параллельной работе
- **orval** генерирует типы + TanStack Query hooks из коробки
- Просто для внешних клиентов (TG-бот, мобилка, интеграции)

**Минусы:**

- Codegen при каждом изменении API (`pnpm generate:api`)
- Нет end-to-end type safety в момент написания handler на бэке
- Дублирование: DTO на бэке + сгенерированные типы

**Структура в monorepo:**

```
packages/shared/src/api/     # сгенерированные типы (orval output)
apps/web/src/shared/api/     # hooks + кастомный axios/fetch client
apps/api/                    # Swagger decorators на controllers
```

### B. openapi-typescript (только типы)

Только типы из OpenAPI, hooks пишем вручную.

**Плюсы:** меньше магии codegen, полный контроль над hooks  
**Минусы:** больше boilerplate на фронте

### C. swagger-typescript-api

Типы + API-клиент, hooks вручную.

**Плюсы:** готовый клиент  
**Минусы:** менее интегрирован с TanStack Query чем orval

### D. tRPC

Сквозная типизация procedures между fe и be без codegen.

**Плюсы:**

- **End-to-end type safety** — меняешь procedure, TypeScript ругается на фронте сразу
- Отличный DX в monorepo
- Меньше boilerplate для CRUD

**Минусы:**

- NestJS + tRPC — **не из коробки**, нужен адаптер (`nestjs-trpc` и др.)
- Swagger из ТЗ не получаем бесплатно
- Сложнее для внешних потребителей API (TG-бот, публичные интеграции)
- Команда должна изучить tRPC; кривая обучения выше
- Отход от ТЗ (Swagger как primary contract)

### E. Ручные типы в `packages/shared` (временно)

**Плюсы:** быстрый старт, нулевая настройка  
**Минусы:** рассинхрон fe/be, не масштабируется

## Предварительная рекомендация

Учитывая **NestJS + Swagger в ТЗ** и **monorepo**:

1. **Старт:** ручные типы в `packages/shared` для 3–5 core-сущностей (`User`, `Project`, `Page`)
2. **После стабилизации API:** orval из Swagger
3. **tRPC** — только если бэкенд-команда готова менять подход и отказаться от Swagger как primary contract

## Критерии принятия решения

- [ ] Готовность бэкенд-команды к tRPC / адаптерам
- [ ] Нужен ли публичный REST API для внешних клиентов
- [ ] Объём codegen vs ручной поддержки приемлем для команды
- [ ] Соответствие требованиям ТЗ (Swagger)

## Следующие шаги

1. Бэкенд поднимает базовый Swagger с 2–3 endpoints
2. Команда пробует orval codegen в ветке spike
3. Опционально: spike tRPC с `nestjs-trpc`
4. Принять ADR-010 после сравнения

## Связанные документы

- [ADR-001](../adr/001-monorepo-structure.md)
- [ADR-004](../adr/004-data-fetching.md)
- [ADR-007](../adr/007-tech-stack.md)
