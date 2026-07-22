# RFC-007: MVP scope первого релиза

**Статус:** Draft  
**Дата:** 2026-07-14

## Контекст

Полный scope из [product-requirements.md](../product-requirements.md) рассчитан на месяцы. Нужно определить минимальный релиз, чтобы команда не распылялась.

## Полный scope (из ТЗ) — reference

- Auth, проекты, вложенные страницы
- Поиск, корзина, медиа, календарь, todo
- Комментарии, collaborative editing, ИИ
- История изменений, SEO-публикации
- Личный кабинет, TG-бот

## Предлагаемые фазы (для обсуждения)

### Phase 1 — Foundation (MVP?)

- [ ] Monorepo init, CI, Docker local
- [ ] Auth (login/register, refresh flow)
- [ ] Проекты + страницы (CRUD)
- [ ] Базовый редактор (текст, headings, todo) — single user
- [ ] Sidebar + `/app/[pageId]` navigation
- [ ] UI kit (shadcn)

### Phase 2 — Collaboration

- [ ] Yjs collaborative editing ([RFC-003](./003-yjs-provider.md))
- [ ] Socket.io presence
- [ ] История изменений (базовая)

### Phase 3 — Content & media

- [ ] Image/video upload (S3)
- [ ] Корзина
- [ ] Поиск (server-side basic)

### Phase 4 — Publishing & integrations

- [ ] SEO-публикации статей
- [ ] ИИ-генерация
- [ ] Календарь + TG-бот
- [ ] `blog.noto.app` ([RFC-004](./004-blog-subdomain.md))

## Критерий готовности MVP (предложение)

Пользователь может: зарегистрироваться → создать проект → создать страницу → написать заметку с todo → вернуться по прямой ссылке `/app/[pageId]`.

## Следующие шаги

1. Командный созвон: согласовать Phase 1 checklist
2. Зафиксировать scope в новом ADR (следующий свободный номер)
3. Создать issues на доске по Phase 1

## Связанные документы

- [product-requirements.md](../product-requirements.md)
- [ADR-009](../adr/009-development-process.md)
