# RFC-003: Yjs provider для collaborative editing

**Статус:** Draft  
**Дата:** 2026-07-14

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
Browser (Tiptap + Yjs)
    │
    ├── Yjs WebSocket ──► Hocuspocus / y-websocket ──► PostgreSQL (snapshots)
    │
    └── Socket.io ──► NestJS Gateway ──► presence, comments, notifications
```

## Следующие шаги

1. Spike Hocuspocus локально с 2 браузерами
2. Проверить auth hook (JWT из access token)
3. Оценить persistence strategy
4. Принять ADR

## Связанные документы

- [ADR-006](../adr/006-realtime.md)
- [RFC-002](./002-rich-text-editor.md)
