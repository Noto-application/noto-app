# RFC-002: Rich-text редактор

**Статус:** Draft  
**Дата:** 2026-07-14

## Контекст

Ядро продукта — Notion-like редактор с блоками, todo, медиа, комментариями, collaborative editing. В [ADR-006](../adr/006-realtime.md) зафиксировано использование Yjs; конкретная библиотека редактора не выбрана.

## Варианты

### A. Tiptap (рекомендация по умолчанию)

ProseMirror-обёртка с extension-системой.

**Плюсы:**

- `@tiptap/extension-collaboration` + Yjs из коробки
- Большое комьюнити, много примеров Notion-like UI
- Гибкие custom blocks (image, video, todo)
- Хорошо с TypeScript

**Минусы:**

- ProseMirror learning curve для кастомных extension
- Некоторые advanced фичи — платные (Tiptap Pro), но базовое collaboration — open source

### B. Lexical (Meta)

**Плюсы:**

- Современная архитектура, хорошая производительность
- `@lexical/yjs` для collaboration

**Минусы:**

- Сложнее для команды на обучении
- Меньше готовых Notion-like примеров
- Больше кода для block-based UI

### C. BlockNote

**Плюсы:**

- Быстрый старт, block-based из коробки
- Красивый default UI

**Минусы:**

- Меньше контроля над кастомизацией
- Collaboration менее зрелая чем Tiptap+Yjs
- Сложнее интегрировать специфичные блоки (календарь, embed)

## Требования из ТЗ к редактору

- [ ] Блоки: текст, todo, image, video
- [ ] Вложенность (страницы — отдельно; блоки внутри страницы)
- [ ] Комментарии inline
- [ ] Collaborative editing (Yjs)
- [ ] История изменений (версии)
- [ ] ИИ-генерация контента (inline или sidebar)
- [ ] Drag-and-drop блоков (`@dnd-kit` — [RFC-005](./005-supplementary-libraries.md))

## Критерии выбора

- [ ] Зрелость Yjs-интеграции
- [ ] Скорость MVP для учебной команды
- [ ] Расширяемость под кастомные блоки
- [ ] Совместимость с [ADR-005](../adr/005-state-management.md) (контент только в Yjs)

## Следующие шаги

1. Spike: Tiptap + Yjs + базовые блоки (text, heading, todo) — 2–3 дня
2. Оценить UX и сложность кастомных блоков
3. Принять ADR после spike

## Связанные документы

- [ADR-006](../adr/006-realtime.md)
- [RFC-003](./003-yjs-provider.md)
