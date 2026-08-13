# ADR-015: Rich-text редактор — BlockNote

**Статус:** Accepted
**Дата:** 2026-08-11

## Контекст

Ядро продукта — Notion-like редактор с блоками, todo, медиа, комментариями и
collaborative editing (Yjs зафиксирован в [ADR-006](./006-realtime.md)).
Библиотеку редактора прорабатывали в [RFC-002](../rfc/002-rich-text-editor.md);
решение устоялось и выносится в ADR.

## Решение

**BlockNote** — block-based редактор на ProseMirror/Tiptap с готовым Notion-like
UI из коробки (slash menu, drag handle, block menu).

- **Готовый UI + block-модель** совпадают с моделью продукта — не собираем
  Notion-интерфейс с нуля, быстрый MVP для учебной команды.
- **TypeScript-first**: типизированные блоки и API.
- **Yjs-collaboration** поддержана `@blocknote/core` — интеграция менее зрелая,
  чем у Tiptap, но достаточна для MVP (проверяется спайком до prod).
- Контент редактора живёт **только в Yjs** (не дублируется в Query/Zustand) —
  согласовано с [ADR-005](./005-state-management.md).

## Последствия

- Default UI BlockNote — отправная точка; стилизация под shadcn/Tailwind —
  отдельная задача.
- Кастомные блоки (календарь, embed, video) потребуют больше усилий, чем на
  «голом» Tiptap, — меньше низкоуровневого контроля.
- Паттерн интеграции в FSD (`features/editor` / `widgets/editor`) фиксируется
  на спайке; collaboration и edge-cases проверяются до prod.

## Отклонённые альтернативы

| Вариант        | Почему нет                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------- |
| Tiptap         | Зрелее Yjs и гибче кастомизация, но Notion-like UI пришлось бы строить самим — дороже для MVP |
| Lexical (Meta) | Современная архитектура, но сложнее для команды и мало Notion-like примеров                   |

## Связанные документы

- [RFC-002](../rfc/002-rich-text-editor.md) — исходная проработка (superseded)
- [ADR-005](./005-state-management.md) — контент только в Yjs + BlockNote
- [ADR-006](./006-realtime.md) — Yjs как CRDT-слой
- [RFC-003](../rfc/003-yjs-provider.md) — выбор Yjs-провайдера
