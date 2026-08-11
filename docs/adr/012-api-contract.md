# ADR-012: Контракт API — REST + ts-rest + shared contracts

**Статус:** Accepted
**Дата:** 2026-08-10

## Контекст

Нужна синхронизация типов между `apps/web` и `apps/api` без дублирования DTO.
Направление прорабатывалось в [RFC-001](../rfc/001-api-contract.md) и обкатано
спайком на auth ([#15](https://github.com/Noto-application/noto-app/pull/15)) и
Projects ([#30](https://github.com/Noto-application/noto-app/pull/30)). Спайк
подтвердил подход — фиксируем решение.

## Решение

- **REST снаружи + ts-rest как contract-first инструмент.**
- **Контракты живут в `packages/shared`** — единый source of truth для фронта и бэка.
- **Схемы на Zod:** типы и runtime-валидация из одного определения.
- **Единый shape ошибок** `{ code, message, details? }`, где `code` —
  машиночитаемый enum (`apiErrorCodeSchema` в `@noto/shared`).
- **Бэкенд:** адаптер `@ts-rest/nest` в связке с Fastify; ошибки маппятся в общий
  shape через exception-filter (`API_ERROR_STATUS`: код → HTTP-статус).
- **Фронтенд:** typed client из shared-контракта + тонкие обёртки под TanStack
  Query. Точную форму обёрток закрепляем по факту FE-4 (#20) — не блокирует ADR.
- **OpenAPI/Swagger:** поддержан через `@ts-rest/open-api` (генерится из тех же
  контрактов), но **не строим сейчас** — отложенный follow-up под реальную
  потребность (внешние клиенты / страница API-доков). В ТЗ значится как
  опциональный ([ADR-007](./007-tech-stack.md)).

## Последствия

- Изменение контракта вызывает ошибку компиляции в местах использования на
  фронте и бэке.
- Runtime-валидация согласована с типами (один Zod-источник).
- Auth-cookie логика остаётся по [ADR-003](./003-authentication.md)
  (`credentials: 'include'`, refresh flow).
- Роутинг в Nest — на контроллерах (через `@TsRestHandler`), единого `routes.ts`
  нет (это Express-паттерн).

## Отклонённые альтернативы

| Вариант                                 | Почему нет                                                        |
| --------------------------------------- | ----------------------------------------------------------------- |
| OpenAPI codegen как первичный источник  | Тяжелее, чем контракт-first на ts-rest; типы и runtime расходятся |
| tRPC                                    | Не REST наружу — хуже для внешних HTTP-клиентов                   |
| Ручные DTO + ручная синхронизация типов | Дублирование, рассинхрон фронт/бэк                                |

## Связанные документы

- [RFC-001](../rfc/001-api-contract.md) — исходная проработка (superseded)
- [ADR-003](./003-authentication.md) — аутентификация и cookies
- [ADR-013](./013-spec-driven-development.md) — contract-first как часть spec→тесты→код
