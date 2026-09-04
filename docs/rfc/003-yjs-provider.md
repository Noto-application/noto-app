# RFC-003: Yjs provider для collaborative editing

**Статус:** Draft (рекомендация к принятию — на ратификацию командой)  
**Дата:** 2026-07-14, обновлён 2026-09-04

## Контекст

[ADR-006](../adr/006-realtime.md) определяет Yjs для синхронизации текста. Нужен конкретный transport/provider между клиентами и persistence слоем.

## Варианты

### A. y-websocket (self-hosted)

Легковесный websocket server для Yjs.

**Плюсы:** простой, полный контроль, бесплатный  
**Минусы:** persistence, auth, scaling — пишем сами

### B. Hocuspocus (Tiptap team)

Yjs backend на Node.js с extensions (database, webhook, auth).

**Плюсы:** auth hooks, persistence plugins, Redis для multi-instance  
**Минусы:** ещё один сервис в инфраструктуре

### C. Встроить в NestJS gateway

Custom websocket gateway на NestJS с y-protocols.

**Плюсы:** один стек с бэкендом  
**Минусы:** больше кастомного кода, риск багов

### D. SaaS (Liveblocks, Partykit)

**Плюсы:** быстрый старт  
**Минусы:** зависимость от внешнего сервиса, не в духе self-hosted ТЗ

## Требования

- [ ] Аутентификация: только участники проекта могут подключиться к doc
- [ ] Persistence: сохранение Yjs state в PostgreSQL или через REST snapshot
- [ ] Multi-instance prod: Redis pub/sub или dedicated collaboration pod
- [ ] Отделение от Socket.io (presence/комментарии остаются на Socket.io)

## Архитектурная схема (целевая)

```
Browser (BlockNote + Yjs)
    │
    ├── Yjs WebSocket ──► Hocuspocus / y-websocket ──► PostgreSQL (snapshots)
    │
    └── Socket.io ──► NestJS Gateway ──► presence, comments, notifications
```

## Результаты спайка (PoC, issue #99)

Подняли минимальный Hocuspocus локально и проверили relay между двумя
клиентами на одном документе: правка на клиенте A мгновенно долетает до B
через общий Yjs-док. Связка **Hocuspocus + Yjs** склеивается без плясок.

- Стек: `@hocuspocus/server` + `@hocuspocus/provider` 2.15.3, `yjs` 13.6.32
  (в node-клиенте `ws` 8.21.3 как WebSocket-полифилл; в браузере — нативный).
- Сервер — три строки: `new Hocuspocus({ port }).listen()`.
- Клиент — `new HocuspocusProvider({ url, name, document })`, старт по `onSynced`.
- Общие Yjs-типы (`Map`, `XmlFragment`) распространяются сами.

Точки расширения, которые дают готовые хуки Hocuspocus (не входят в PoC):

- **Auth на хендшейке:** серверный хук `onAuthenticate` — проверка access-токена
  до доступа к документу (только участник проекта).
- **Persistence:** хуки `onLoadDocument` / `onStoreDocument` (или
  `@hocuspocus/extension-database`) — снапшот Yjs-state в PostgreSQL.
- **BlockNote (FE):** `useCreateBlockNote({ collaboration: { provider,
  fragment, user } })` с тем же провайдером.

## Предлагаемое решение

**Вариант B — Hocuspocus.** Он закрывает наши требования (auth, persistence,
multi-instance) готовыми хуками/расширениями — меньше кастомного кода, чем у
голого y-websocket (A) или собственного NestJS-gateway (C), и без внешней
зависимости SaaS (D). Presence/комментарии остаются на Socket.io, как в схеме.

## Следующие шаги

1. ~~Spike Hocuspocus локально~~ — сделано (PoC, relay доказан).
2. Ратифицировать выбор на планёрке → продвинуть RFC в ADR.
3. Auth hook (access-токен на `onAuthenticate`) — следующий спринт.
4. Persistence strategy (снапшоты в PostgreSQL) — следующий спринт.
5. BlockNote ↔ Yjs binding на фронте — задача спринта (FE).

## Связанные документы

- [ADR-006](../adr/006-realtime.md)
- [RFC-002](./002-rich-text-editor.md)
