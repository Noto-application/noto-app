# ADR-006: Realtime-архитектура

**Статус:** Accepted  
**Дата:** 2026-07-14

## Контекст

ТЗ требует совместное редактирование через Websockets + Socket.io. Нужно разделить transport по типам realtime-задач — посимвольная синхронизация документа и event-based обновления.

## Решение

### Разделение по типу задачи

| Задача                           | Технология                      | Почему                                                                  |
| -------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Синхронизация текста в редакторе | **Yjs + CRDT**                  | Конфликты при одновременном редактировании; OT вручную — слишком сложно |
| Presence (кто онлайн)            | **Socket.io**                   | Event-based, не нужен CRDT                                              |
| Курсоры других пользователей     | **Socket.io** или Yjs awareness | Зависит от выбора редактора                                             |
| Уведомления                      | **Socket.io**                   | Push-события                                                            |
| Комментарии (live-обновления)    | **Socket.io + REST API**        | CRUD через REST, live через socket events                               |

### Ключевое правило

> **Socket.io не используется для посимвольной синхронизации документа.**

Для этого нужен CRDT (Yjs). Socket.io в ТЗ — для изучения websockets в контексте presence, комментариев, уведомлений.

### Планируемый стек редактора

- **BlockNote** — rich-text / block-редактор ([ADR-015](./015-rich-text-editor.md))
- **Yjs** — collaborative editing
- **@dnd-kit** — drag-and-drop блоков и дерева страниц

### Yjs provider

Конкретный provider (y-websocket, Hocuspocus, self-hosted) — **не выбран**, см. [RFC-003](../rfc/003-yjs-provider.md).

## Альтернативы

| Вариант                                    | Почему отклонён                        |
| ------------------------------------------ | -------------------------------------- |
| Socket.io для всего realtime включая текст | Конфликты, потеря символов, сложный OT |
| Polling вместо websockets                  | Не realtime, не соответствует ТЗ       |
| Liveblocks / Partykit SaaS                 | Возможны, но не в базовом стеке ТЗ     |

## Последствия

- Бэкенд: два realtime-канала — Yjs websocket server + Socket.io gateway
- Фронтенд: Socket.io client только в `/app`, не на public pages
- Prod в нескольких инстансах: Socket.io Redis adapter; Yjs — sticky sessions или dedicated collaboration server

## Связанные документы

- [ADR-005](./005-state-management.md) — контент только в Yjs
- [RFC-002](../rfc/002-rich-text-editor.md)
- [RFC-003](../rfc/003-yjs-provider.md)
