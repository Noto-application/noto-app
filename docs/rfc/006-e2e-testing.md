# RFC-006: E2E-тестирование

**Статус:** Draft  
**Дата:** 2026-07-14

## Контекст

[ADR-009](../adr/009-development-process.md) требует тесты на основной функционал. Unit/integration — Vitest + RTL. E2E-стратегия не определена.

## Предварительная рекомендация

**Playwright** — для критичных user flows.

## Приоритетные сценарии

| # | Сценарий | Почему критично |
|---|----------|-----------------|
| 1 | Login → redirect `/app` | [ADR-003](../adr/003-authentication.md) auth flow |
| 2 | Создать проект → создать страницу | Core CRUD |
| 3 | Открыть `/app/[pageId]` → редактировать текст | Редактор + URL navigation |
| 4 | Logout / expired session → `/login` | 401 + refresh flow |
| 5 | Опубликовать статью → видна на public URL | SEO path |

## Collaborative editing в E2E

Тестирование Yjs (2 браузера одновременно) — сложно и flaky. Варианты:

- **A)** E2E только на single-user edit; collaboration — integration tests с mock provider
- **B)** Playwright 2 contexts в одном тесте — дорого, но возможно для smoke
- **C)** Отложить collaboration E2E до стабилизации [RFC-003](./003-yjs-provider.md)

## CI

- [ ] Playwright в CI на PR — только smoke (быстрые тесты)
- [ ] Полный E2E suite — на release branch / nightly

## Следующие шаги

1. Добавить Playwright в `apps/web` после инициализации
2. Написать 2 smoke-теста (login, create page)
3. Принять ADR с scope E2E

## Связанные документы

- [ADR-009](../adr/009-development-process.md)
