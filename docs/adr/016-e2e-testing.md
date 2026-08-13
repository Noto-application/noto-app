# ADR-016: E2E-тестирование — Playwright

**Статус:** Accepted
**Дата:** 2026-08-11

## Контекст

[ADR-009](./009-development-process.md) требует тесты на основной функционал.
Unit/integration — Vitest + RTL ([ADR-007](./007-tech-stack.md)), E2E-стратегия
прорабатывалась в [RFC-006](../rfc/006-e2e-testing.md). Решение устоялось и
выносится в ADR.

## Решение

**Playwright** — для критичных user-flow в `apps/web`.

- **Cross-browser из коробки** (Chromium, Firefox, WebKit) без доп. настройки.
- **Параллельные browser-context'ы** в одном тесте — пригодно для smoke
  collaboration (два пользователя).
- **Auto-wait** снижает flaky по сравнению с ручными waits; trace/screenshot/
  video ускоряют диагностику падений в CI.
- **TypeScript-first** — совпадает со стеком monorepo.

Приоритетные сценарии: login → `/app`, создание проекта/страницы, редактирование
`/app/[pageId]`, logout/expired session, публикация статьи на public URL.

## Последствия

- Collaborative editing в E2E на MVP — **single-user edit**; Yjs-collaboration
  (2 браузера) остаётся integration-тестами с mock-provider, один Playwright
  smoke на 2 context'а — после стабилизации [RFC-003](../rfc/003-yjs-provider.md).
- CI: на PR — только smoke (быстрые); полный E2E suite — на release/nightly.
- Playwright добавляется в `apps/web` после инициализации приложения; первые
  тесты — login и create page.

## Отклонённые альтернативы

| Вариант | Почему нет                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| Cypress | Один browser-tab на тест — тяжелее многопользовательские сценарии; WebKit ограничен; медленнее полный suite в CI |

## Связанные документы

- [RFC-006](../rfc/006-e2e-testing.md) — исходная проработка (superseded)
- [ADR-007](./007-tech-stack.md) — стек тестирования
- [ADR-009](./009-development-process.md) — процесс и требования к тестам
