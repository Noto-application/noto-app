# ADR-003: Аутентификация и защита `/app`

**Статус:** Accepted  
**Дата:** 2026-07-14

## Контекст

Приватная зона `/app/*` требует аутентификации. Поскольку `Next.js Middleware` работает на сервере и не имеет доступа к `localStorage`, аутентификация должна опираться на cookie, доступные уже на первом запросе.

## Решение

### Хранение токенов

| Токен | Где хранится | Кто устанавливает |
|-------|--------------|-------------------|
| Access token | HttpOnly cookie | Бэкенд (NestJS) |
| Refresh token | HttpOnly cookie | Бэкенд (NestJS) |

Оба cookie отправляются браузером автоматически. Для production обязательны `Secure`; `SameSite` настраивается в соответствии с финальной схемой доменов и кросс-сайтовых запросов.

### Защита маршрутов `/app/*`

**Next.js Middleware:**

1. Запрос к `/app/*` → middleware проверяет наличие `access token` в cookie
2. Access token валиден → пропускаем запрос
3. Access token отсутствует или истёк → пробуем refresh через `refresh token` в HttpOnly cookie
4. Refresh успешен → бэкенд выставляет новые cookie, middleware пропускает запрос
5. Refresh неуспешен → очищаем auth-cookie и редиректим на `/login`

### Обработка 401 от API в `/app`

**Паттерн B (принят):**

1. Любой API-запрос вернул `401`
2. Пробуем один refresh через HttpOnly cookie
3. Refresh успешен → повторяем оригинальный запрос
4. Refresh неуспешен → logout, очистка auth-cookie, редирект на `/login`

Реализация: interceptor в API-клиенте / TanStack Query `queryClient` global handler. Все запросы, требующие авторизации, отправляются с `credentials: 'include'`.

### Страницы auth

- `/login`, `/register` — в зоне `(public)`, без QueryClientProvider
- После login → redirect в `/app` (или на `redirectUrl` из query params)

## Альтернативы

| Вариант | Почему отклонён |
|---------|-----------------|
| Access token в `localStorage` + refresh token в cookie | Middleware не видит `localStorage`, сложно надёжно защищать `/app/*` на сервере |
| JWT в localStorage без refresh | Плохой UX при истечении сессии |
| Только client-side guard | Flash неавторизованного контента до гидрации |
| Toast "сессия истекла" без auto-refresh | Хуже UX |

## Последствия

- Бэкенд обязан выставлять и ротировать `access`/`refresh` cookie при `login`, `refresh`, `logout`
- Бэкенд обязан реализовать `POST /auth/refresh`, читающий `refresh token` из HttpOnly cookie
- Фронтенд: единый API client с interceptors в `apps/web`
- Все авторизованные запросы должны отправляться с cookie (`credentials: 'include'`)
- CSRF-защита обязательна для state-changing endpoint'ов: минимум `SameSite`, при необходимости отдельный CSRF token
- Middleware может принимать решение по аутентификации уже на первом запросе к `/app`, без зависимости от клиентской гидрации

## Связанные документы

- [ADR-004](./004-data-fetching.md) — Query только в `/app`
- [ADR-002](./002-routing-and-domains.md) — какие маршруты защищены
