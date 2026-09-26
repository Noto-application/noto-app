# ADR-006: Realtime-архитектура

**Статус:** Accepted  
**Дата:** 2026-07-14  
**Обновлён:** 2026-09-26 — зафиксирован выбор Yjs provider (Hocuspocus)

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

Provider — **Hocuspocus** (self-hosted, сервис `apps/collab`). Выбор проработан в
[RFC-003](../rfc/003-yjs-provider.md) и ратифицирован командой 2026-09-26; RFC
переведён в Superseded и оставлен как история проработки.

Почему Hocuspocus, а не голый y-websocket или собственный gateway на NestJS:
готовые хуки закрывают наши требования без кастомного протокольного кода.

| Требование              | Как закрыто                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| Auth на хендшейке       | `onAuthenticate` → проверка access-cookie через internal-endpoint API |
| Persistence Yjs-state   | `onLoadDocument` / `onStoreDocument` → снапшоты в PostgreSQL          |
| Редактор на том же доке | BlockNote + `HocuspocusProvider` на общем `Y.Doc`                     |

Реализовано: auth-hook, persistence-снапшоты, BlockNote ↔ Yjs binding.

## Альтернативы

| Вариант                                    | Почему отклонён                        |
| ------------------------------------------ | -------------------------------------- |
| Socket.io для всего realtime включая текст | Конфликты, потеря символов, сложный OT |
| Polling вместо websockets                  | Не realtime, не соответствует ТЗ       |
| Liveblocks / Partykit SaaS                 | Возможны, но не в базовом стеке ТЗ     |

## Последствия

- Бэкенд: два realtime-канала — Yjs websocket server + Socket.io gateway
- Фронтенд: Socket.io client только в `/app`, не на public pages
- Collab — отдельный сервис (`apps/collab`), а не часть NestJS-процесса
- **MVP работает на одном collab-инстансе**: дока живёт в памяти одного процесса,
  горизонтальное масштабирование не поддержано. Несколько инстансов потребуют
  sticky sessions или Redis-расширения Hocuspocus — отдельная будущая работа
- Socket.io-канал (presence, комментарии, уведомления) в коде пока **не начат** —
  раздел выше описывает целевую архитектуру, не текущее состояние. Его
  multi-instance режим потребует Redis adapter

## Связанные документы

- [ADR-005](./005-state-management.md) — контент только в Yjs
- [RFC-002](../rfc/002-rich-text-editor.md)
- [RFC-003](../rfc/003-yjs-provider.md) — проработка выбора provider (Superseded)
