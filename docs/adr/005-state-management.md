# ADR-005: State management — границы слоёв

**Статус:** Accepted  
**Дата:** 2026-07-14

## Контекст

Четыре источника состояния (URL, TanStack Query, Zustand, Yjs) без чётких границ приводят к дублированию, рассинхрону и сложности отладки.

## Решение

### Матрица ответственности

| Слой | Что хранит | Примеры |
|------|------------|---------|
| **URL** | Текущий контекст навигации | `/app/[pageId]` — открытая страница |
| **TanStack Query** | Server state с API | проекты, метаданные страниц, поиск, корзина, история, настройки пользователя, комментарии (список) |
| **Zustand** | UI state только | сайдбар open/collapsed, модалки, theme, размеры панелей |
| **Yjs + BlockNote** | Контент страницы в редакторе | live-текст, блоки при collaborative editing |

### Правила

1. **Контент редактора не дублировать** в Query и Zustand — только Yjs/BlockNote
2. **Zustand — только UI**, не бизнес-данные и не навигация по страницам
3. **Текущая страница — в URL**, не в Zustand (аналогия с Notion)
4. Метаданные страницы (title, `updatedAt`, permissions) — **TanStack Query**
5. Оптимистичные обновления метаданных — через Query mutations + invalidation

### Что НЕ кладём в Zustand

- Текущий `pageId` / `projectId` (это URL)
- Список проектов, дерево страниц (это Query)
- Текст документа (это Yjs)
- Выделенные блоки редактора (остаётся в BlockNote editor state)
- Черновики форм до отправки (формы — React Hook Form local state)

## Альтернативы

| Вариант | Почему отклонён |
|---------|-----------------|
| Zustand для навигации | Нет deep links, ломается «назад» в браузере |
| Query для контента редактора | Не подходит для realtime CRDT |
| Zustand для selection в редакторе | BlockNote уже держит selection state |

## Последствия

- При смене `[pageId]` в URL — unmount/remount редактора, новый Yjs doc
- UI preferences (sidebar collapsed) — опционально persist в `localStorage` через Zustand middleware
- Чёткий onboarding для команды: «куда класть новое состояние?»

## Связанные документы

- [ADR-002](./002-routing-and-domains.md) — URL-first навигация
- [ADR-004](./004-data-fetching.md) — TanStack Query scope
- [ADR-006](./006-realtime.md) — Yjs scope
- [RFC-002](../rfc/002-rich-text-editor.md) — выбор редактора
