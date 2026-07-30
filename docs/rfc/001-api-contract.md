# RFC-001: Контракт API — REST + ts-rest + shared contracts

**Статус:** Направление принято; детали проверяет спайк на auth (#3)
**Дата:** 2026-07-20
**Обновлён:** 2026-07-31

## Статус проработки

Направление зафиксировано и не меняется — по нему можно начинать работу.
Детали реализации проверяются **спайком на auth-эндпоинтах** (#3), после чего
подход закрепляется отдельным ADR.

**Принято (твёрдо):**

- REST снаружи + **ts-rest** как contract-first инструмент
- Контракты живут в `packages/shared` — единый source of truth
- Схемы на **Zod**: типы и runtime-валидация из одного определения
- Единый shape ошибок `{ code, message, details? }` (`code` — машиночитаемый enum)

**Проверяет спайк auth (#3), затем ADR:**

- Adapter ts-rest под NestJS **в связке с Fastify** (перешли на Fastify — [#12](https://github.com/Noto-application/noto-app/pull/12))
- Как ошибки маппятся в общий shape на всех слоях
- Генерируем ли Swagger/OpenAPI из контракта (`@ts-rest/open-api`) или держим отдельно

Пока эти три пункта не обкатаны на реальных эндпоинтах, ADR не пишем — иначе
зафиксируем непроверенное.

## Контекст

Monorepo с `apps/web`, `apps/api`, `packages/shared`. Нужен способ синхронизации типов между фронтом и бэкендом без дублирования DTO и ручного поддержания соответствия.

Команда уже обсуждала варианты (OpenAPI/Swagger и tRPC), но текущий RFC устарел. Предлагается обновить подход под:

- **REST** как основа API (удобно для внешних клиентов и интеграций по HTTP)
- **ts-rest** как contract-first инструмент
- **shared contracts** как source of truth для схем и типизации

## Цели

1. **Source of truth:** контракты (эндпоинты + request/response + единый shape ошибок) живут в `packages/shared`.
2. **Типы совпадают с runtime:** контракты собираются из валидаторов (обычно Zod), чтобы и типы, и runtime-валидация следовали одному определению.
3. **Compile-time безопасность:** при изменении контракта ошибки должны проявляться на фронте/бэке на этапе TypeScript.
4. **Никакого “двойного описания”:** меньше DTO/сигнатур, больше переиспользования.
5. **REST сохраняется:** обычные HTTP paths/methods для внешних потребителей.

## Решение: contract-first на ts-rest + shared

### 1) Контракты в `packages/shared`

В `packages/shared/src/api/` определяем эндпоинты через ts-rest:

- методы и пути (`GET/POST/...`, paths);
- схемы параметров и payload'ов;
- типизированные ответы;
- (опционально) единый стандарт ошибок.

Итог: фронт и бэкенд импортируют один и тот же контракт.

### 2) Реализация на бэкенде (`apps/api`)

`apps/api` подключает адаптер ts-rest для выбранной HTTP платформы (NestJS через соответствующий adapter или обертку).

Далее backend:

- wire контракт -> handlers;
- применяет contract-валидацию (если это предусмотрено подходом);
- маппит ошибки в общий shape (если стандартизируем).

### 3) Использование на фронтенде (`apps/web`)

`apps/web` строит typed client из shared контракта.

Дальше возможны 2 режима (выбирается после spike):

- typed client + тонкие wrappers под TanStack Query;
- прямые hooks из ts-rest интеграции (если выбрана подходящая integration-обвязка).

В обоих случаях auth-cookie логика остаётся совместимой с ADR-003 (credentials/cookies на запросах, refresh flow).

### 4) Версии: `@ts-rest/*` 3.53.0-rc.1

**RC** (Release Candidate) — пререлизная версия: функционально готова, но ещё не
объявлена стабильной; API и peer dependencies могут измениться до финального релиза.

**Почему RC, а не stable 3.52.x:**

- В monorepo уже **Zod 4** (`zod@4.4.3`): env-схема API, контракты в
  `packages/shared` (`z.email()`, `z.iso.datetime()` и т.д.).
- Стабильные `@ts-rest/*` 3.52.x ориентированы на **Zod 3** (peer dependency
  `^3.22.3`); с Zod 4 — конфликты зависимостей и типов.
- Поддержка Zod 4 (и Standard Schema) в ts-rest доступна начиная с
  **`3.53.0-rc.1`** ([changelog](https://ts-rest.com/changelog)).

**Принято на время спайка:**

- `@ts-rest/core@3.53.0-rc.1` в `packages/shared`, `@ts-rest/nest@3.53.0-rc.1` в
  `apps/api` — **одна и та же версия** в обоих пакетах.
- Откат на Zod 3 ради stable ts-rest не рассматриваем — лишний churn по всему
  monorepo без выигрыша.

**Риск и выход:** RC — компромисс «Zod 4 сейчас vs stable ts-rest». После выхода
stable `3.53+` с поддержкой Zod 4 — обновиться с RC на финальный релиз; зафиксировать
в ADR после спайка auth.

## Структура в monorepo

```
packages/shared/src/api/
  contract/            # ts-rest контракт: endoints + schemas
  errors.ts            # единый shape ошибок (если нужен)
  index.ts

apps/api/
  src/http/rest/
    routes.ts          # wire contract -> handlers (ts-rest adapter)
    index.ts

apps/web/
  src/shared/api/
    client.ts          # ts-rest client + baseUrl
    hooks.ts           # wrappers под TanStack Query (опционально)
```

## Неизвестные / что нужно подтвердить spike'ом

- Какой именно adapter ts-rest удобнее в контексте NestJS.
- Нужны ли дополнительные layers для TanStack Query (hooks “из коробки” vs thin wrappers).
- Как стандартизируем ошибки (например `code/message/details`) и как это маппится на всех слоях.
- Как поступаем с API-документацией: генерируем ли OpenAPI/Swagger из контракта ts-rest или держим документацию отдельно (это не блокирует основной contract-first подход).
- Подтвердить, что авторизация и cookies полностью соответствуют схеме из ADR-003.
- Когда выйдет stable `@ts-rest/*` с Zod 4 — миграция с `3.53.0-rc.1` (сейчас
  осознанно принят RC, см. выше).

## Критерии принятия решения (success criteria)

- Изменение контракта вызывает ошибку компиляции в местах использования на фронте/бэке.
- Runtime-валидация согласована с типами из shared контракта.
- Запросы в `/app/*` корректно отправляют cookie (и refresh flow работает через interceptor/Query handler как в ADR-003).
- API остаётся доступным как обычный REST через HTTP endpoints (для внешних клиентов).



## Следующие шаги

1. Spike на 2–3 endpoint'ах (например auth + одна сущность: `projects.list`).
2. Зафиксировать подход к валидаторам (Zod?) и формат ошибок в `packages/shared`.
3. Подключить typed client и интеграцию на фронте под TanStack Query.
4. (Опционально) договориться об источнике API-документации: OpenAPI из контракта vs separate docs.
5. Принять новый ADR (следующий свободный номер) после оценки с альтернативами (OpenAPI codegen, tRPC).

## Связанные документы

- [ADR-003](../adr/003-authentication.md)
- [ADR-004](../adr/004-data-fetching.md)
- [ADR-007](../adr/007-tech-stack.md)
