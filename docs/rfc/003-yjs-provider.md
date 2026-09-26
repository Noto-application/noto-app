# RFC-003: Yjs provider для collaborative editing

**Статус:** Superseded by [ADR-006](../adr/006-realtime.md)  
**Дата:** 2026-07-14  
**Обновлён:** 2026-09-26

> Решение (**Hocuspocus**) ратифицировано командой и вынесено в
> [ADR-006](../adr/006-realtime.md), раздел «Yjs provider».
> Этот RFC оставлен как история проработки: контекст, альтернативы, результаты
> спайка. Актуальное состояние стека — в ADR-006.

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

- [x] Аутентификация: только участники проекта могут подключиться к doc — `onAuthenticate` (#108)
- [x] Persistence: сохранение Yjs state в PostgreSQL через REST snapshot — `onLoadDocument`/`onStoreDocument` (#109)
- [ ] Multi-instance prod: Redis pub/sub или dedicated collaboration pod — не сделано, MVP на одном инстансе
- [x] Отделение от Socket.io (presence/комментарии остаются на Socket.io) — Yjs-канал отдельный сервис; сам Socket.io-канал ещё не начат

## Архитектурная схема (целевая)

Yjs-ветка реализована, Socket.io-ветка — план.

```
Browser (BlockNote + Yjs)
    │
    ├── Yjs WebSocket ──► Hocuspocus (apps/collab) ──► PostgreSQL (snapshots)
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

## Решение: Hocuspocus (принято, см. [ADR-006](../adr/006-realtime.md))

**Вариант B — Hocuspocus.** Он закрывает наши требования (auth, persistence,
multi-instance) готовыми хуками/расширениями — меньше кастомного кода, чем у
голого y-websocket (A) или собственного NestJS-gateway (C), и без внешней
зависимости SaaS (D). Presence/комментарии остаются на Socket.io, как в схеме.

## Что сделано

1. ~~Spike Hocuspocus локально~~ — PoC, relay доказан (#99).
2. ~~Ратификация выбора~~ — принято, зафиксировано в [ADR-006](../adr/006-realtime.md) (#150).
3. ~~Auth hook на `onAuthenticate`~~ — сервис `apps/collab` проверяет access-cookie
   через internal-endpoint API, fail-closed (#108).
4. ~~Persistence~~ — снапшоты Yjs-state в PostgreSQL через `onLoadDocument` /
   `onStoreDocument` с дебаунсом (#109).
5. ~~BlockNote ↔ Yjs binding~~ — `HocuspocusProvider` + `withCollaboration` на
   общем `Y.Doc` (#110).

Стек в коде: `@hocuspocus/server` / `@hocuspocus/provider` 2.15.3, `yjs` 13.6.32.

## Границы и будущая работа

- **MVP — один collab-инстанс.** Документ живёт в памяти процесса; нескольким
  инстансам нужны sticky sessions или Redis-расширение Hocuspocus. Отдельная задача.
- **Socket.io-канал** (presence, курсоры, комментарии, уведомления) в коде **не
  начат** — целевая схема выше описывает план, не текущее состояние.
- Права на запись (`viewer` read-only) — [#149](https://github.com/Noto-application/noto-app/issues/149).

## Связанные документы

- [ADR-006](../adr/006-realtime.md) — принятое решение
- [RFC-002](./002-rich-text-editor.md)
