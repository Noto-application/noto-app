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

Единый origin за Caddy — иначе HttpOnly access-cookie не долетит на `/collab`,
а CORS отрежет запросы фронта. Поэтому фронт должен ходить в API **через тот же
origin** (`:8080`), а API — разрешать этот origin.

```bash
# 1. env ПЕРВЫМ (до запуска сервисов)
cp apps/collab/.env.example apps/collab/.env

# Единый origin: фронт бьёт в API через Caddy, API разрешает :8080
#   apps/web/.env :  NEXT_PUBLIC_API_URL=http://localhost:8080
#   apps/api/.env :  CORS_ORIGIN=http://localhost:8080
# collab: COLLAB_ALLOWED_ORIGINS=http://localhost:8080 (уже в .env.example),
#         API_INTERNAL_URL=http://localhost:4000 (напрямую, internal endpoint)

# 2. Все сервисы разом: turbo поднимает api + web + collab
pnpm docker:up
pnpm dev

# 3. Caddy — единый origin http://localhost:8080
caddy run --config ./Caddyfile
```

Открывать приложение на `http://localhost:8080` (не :3000) — тогда cookie
одного origin уходит и на REST (`/api`), и на WS (`/collab`).

> Изоляция internal-endpoint: Caddy не проксирует `/internal/*`, но «API
> недоступен в обход Caddy» — требование деплоя. В dev достаточно, что фронт
> ходит через :8080; в проде публиковать только Caddy, порт API держать в
> приватной сети (loopback/без publish). На уровне приложения endpoint
> защищён сервисным секретом.

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
