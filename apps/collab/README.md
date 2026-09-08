# @noto/collab

Collaborative editing (Yjs) через Hocuspocus. Авторизация документа на
WS-хендшейке (#108). Спека: [`docs/specs/108-collab-auth.spec.md`](../../docs/specs/108-collab-auth.spec.md).

## Что здесь

- `src/auth/authorize-connection.ts` — чистая логика решения (allowlist origin,
  извлечение access_token, делегирование в API, fail-closed). Покрыта unit.
- `src/collab-auth-api.ts` — HTTP-клиент к internal-endpoint API.
- `src/config/collab-env.ts` — конфиг (пустой секрет запрещает старт).
- `src/server.ts` — Hocuspocus + `onAuthenticate` → `authorizeConnection`.

## Запуск (dev)

Единый origin за Caddy — иначе HttpOnly access-cookie не долетит на `/collab`.

```bash
# 1. Инфра
pnpm docker:up

# 2. API (порт 4000) и фронт (порт 3000)
pnpm dev

# 3. collab (порт 5555)
cp apps/collab/.env.example apps/collab/.env
pnpm --filter @noto/collab dev

# 4. Caddy — единый origin http://localhost:8080
caddy run --config ./Caddyfile
```

Открывать приложение на `http://localhost:8080` (не :3000) — тогда cookie
одного origin уходит и на REST, и на WS.

## Ручная проверка (спайк, realtime тестами не гоним)

- [ ] Участник проекта открывает страницу → WS `/collab` подключается,
      правки синхронизируются между двумя вкладками.
- [ ] Посторонний (не участник) → соединение отклоняется, документ не отдаётся.
- [ ] Отказ к чужому документу на уже открытом WS (переключение на чужой
      `documentName` → повторный `onAuthenticate` отклоняет).
- [ ] При отказе клиент не получает контент документа.
- [ ] `curl http://localhost:8080/internal/collab/authorize` снаружи → недоступен
      (Caddy не проксирует `/internal/*`).

## Вне scope #108

Persistence Yjs-state (#109), viewer read-only на запись, presence/комментарии.
