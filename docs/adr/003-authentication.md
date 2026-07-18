# ADR-003: Аутентификация и защита `/app`

**Статус:** Accepted  
**Дата:** 2026-07-14

## Контекст

Приватная зона `/app/*` требует аутентификации. Access token в `localStorage` недоступен middleware на сервере — нужен согласованный flow с refresh token.

## Решение

### Хранение токенов

| Токен | Где хранится | Кто устанавливает |
|-------|--------------|-------------------|
| Access token | `localStorage` | Фронтенд после login/refresh |
| Refresh token | HttpOnly cookie | Бэкенд (NestJS) |

### Защита маршрутов `/app/*`

**Next.js Middleware:**

1. Запрос к `/app/*` → проверяем наличие валидного access token (если передаётся через заголовок/cookie — на этапе реализации уточнить механизм для middleware)
2. Access token отсутствует или истёк → **пробуем refresh** через HttpOnly cookie (запрос к `/api/auth/refresh`)
3. Refresh успешен → сохраняем новый access token, пропускаем запрос
4. Refresh неуспешен → **logout + редирект на `/login`**

### Обработка 401 от API в `/app`

**Паттерн B (принят):**

1. Любой API-запрос вернул `401`
2. Пробуем **один** refresh через HttpOnly cookie
3. Refresh успешен → повторяем оригинальный запрос
4. Refresh неуспешен → **logout, очистка localStorage, редирект на `/login`**

Реализация: interceptor в API-клиенте / TanStack Query `queryClient` global handler.

### Страницы auth

- `/login`, `/register` — в зоне `(public)`, без QueryClientProvider
- После login → redirect в `/app` (или на `redirectUrl` из query params)

## Альтернативы

| Вариант | Почему отклонён |
|---------|-----------------|
| HttpOnly cookie для access token | Сложнее для SPA-like `/app`, выбран localStorage |
| JWT в localStorage без refresh | Плохой UX при истечении сессии |
| Только client-side guard | Flash неавторизованного контента до гидрации |
| Toast «сессия истекла» без auto-refresh | Хуже UX |

## Последствия

- Бэкенд обязан реализовать `POST /auth/refresh` с HttpOnly cookie
- Фронтенд: единый API client с interceptors в `apps/web`
- CSRF: refresh endpoint должен быть защищён (SameSite cookie, CSRF token при необходимости)
- Middleware не имеет прямого доступа к localStorage — refresh flow критичен для первого входа в `/app`

## Связанные документы

- [ADR-004](./004-data-fetching.md) — Query только в `/app`
- [ADR-002](./002-routing-and-domains.md) — какие маршруты защищены
