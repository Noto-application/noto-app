# RFC-006: E2E-тестирование

**Статус:** Accepted  
**Дата:** 2026-07-20

## Контекст

[ADR-009](../adr/009-development-process.md) требует тесты на основной функционал. Unit/integration — Vitest + RTL. E2E-стратегия не определена.

## Решение: Playwright

**Playwright** — для критичных user flows в `apps/web`.

### Почему Playwright

- **Multi-browser из коробки** — Chromium, Firefox, WebKit без дополнительной настройки
- **Параллельные контексты** — два browser context в одном тесте (пригодно для smoke collaboration)
- **Auto-wait** — меньше flaky-тестов по сравнению с ручными waits
- **Trace / screenshot / video** — быстрая диагностика падений в CI
- **TypeScript-first** — совпадает со стеком monorepo

## Рассмотренные альтернативы

### A. Cypress

**Плюсы:** удобный DX, time-travel debugging, популярен в React-экосистеме.

**Минусы:** один browser tab на тест — сложнее сценарии с несколькими пользователями; WebKit ограничен; медленнее на полном suite в CI.

### B. Playwright ✅

**Плюсы:** multi-context, cross-browser, стабильные auto-waits, хорошая интеграция с CI.

**Минусы:** чуть выше порог входа, чем у Cypress; меньше «магии» в интерактивном runner.

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

**Предварительная рекомендация:** A на MVP; B — один smoke-тест после стабилизации provider.

## CI

- [ ] Playwright в CI на PR — только smoke (быстрые тесты)
- [ ] Полный E2E suite — на release branch / nightly

## Следующие шаги

1. Добавить Playwright в `apps/web` после инициализации
2. Написать 2 smoke-теста (login, create page)
3. Подключить smoke suite в CI ([ADR-009](../adr/009-development-process.md))

## Связанные документы

- [ADR-007](../adr/007-tech-stack.md)
- [ADR-009](../adr/009-development-process.md)
