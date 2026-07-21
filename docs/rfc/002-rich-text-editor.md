# RFC-002: Rich-text редактор

**Статус:** Accepted  
**Дата:** 2026-07-20

## Контекст

Ядро продукта — Notion-like редактор с блоками, todo, медиа, комментариями, collaborative editing. В [ADR-006](../adr/006-realtime.md) зафиксировано использование Yjs; библиотека редактора выбрана в этом RFC.

## Решение: BlockNote

**BlockNote** — block-based редактор на ProseMirror/Tiptap с готовым UI из коробки.

### Почему BlockNote

- **Core + UI сразу** — не нужно собирать Notion-like интерфейс с нуля (slash menu, drag handle, block menu, типографика)
- **Block-based из коробки** — соответствует модели продукта без отдельного слоя block UI
- **Быстрый MVP** — меньше кода и spike-работы для учебной команды
- **TypeScript** — типизированные блоки и API
- **Yjs** — `@blocknote/core` поддержива collaboration через Yjs (интеграция менее зрелая, чем у Tiptap, но достаточная для MVP)

### Принятые компромиссы

- Меньше низкоуровневого контроля, чем у «голого» Tiptap — кастомные блоки (календарь, embed) потребуют больше усилий
- Default UI BlockNote — отправная точка; стилизация под shadcn/Tailwind — отдельная задача
- Collaboration и edge-cases — проверить на spike до prod

## Рассмотренные альтернативы

### A. Tiptap

ProseMirror-обёртка с extension-системой.

**Плюсы:** зрелая `@tiptap/extension-collaboration` + Yjs, гибкие custom blocks, большое комьюнити.

**Минусы:** Notion-like UI нужно строить самим; выше learning curve для кастомных extension.

### B. Lexical (Meta)

**Плюсы:** современная архитектура, `@lexical/yjs`.

**Минусы:** сложнее для команды, мало готовых Notion-like примеров, больше кода для block-based UI.

## Требования из ТЗ к редактору

- [ ] Блоки: текст, todo, image, video
- [ ] Вложенность (страницы — отдельно; блоки внутри страницы)
- [ ] Комментарии inline
- [ ] Collaborative editing (Yjs)
- [ ] История изменений (версии)
- [ ] ИИ-генерация контента (inline или sidebar)
- [ ] Drag-and-drop блоков (`@dnd-kit` — [RFC-005](./005-supplementary-libraries.md))

## Критерии выбора

| Критерий | BlockNote |
|----------|-----------|
| Зрелость Yjs-интеграции | Достаточно для MVP; Tiptap сильнее, но не критично на старте |
| Скорость MVP для учебной команды | ✅ Готовый UI снижает объём работ |
| Расширяемость под кастомные блоки | Приемлемо; Tiptap гибче на длинной дистанции |
| Совместимость с [ADR-005](../adr/005-state-management.md) | ✅ Контент только в Yjs, editor state в BlockNote |

## Следующие шаги

1. Spike: BlockNote + Yjs + базовые блоки (text, heading, todo) — 2–3 дня
2. Оценить стилизацию под shadcn/Tailwind и сложность кастомных блоков (image, video)
3. Зафиксировать паттерн интеграции в FSD (`features/editor` или `widgets/editor`)

## Связанные документы

- [ADR-005](../adr/005-state-management.md) — контент в Yjs + BlockNote
- [ADR-006](../adr/006-realtime.md)
- [RFC-003](./003-yjs-provider.md)
