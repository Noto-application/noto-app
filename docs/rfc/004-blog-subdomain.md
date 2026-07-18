# RFC-004: Вынос публичных статей на `blog.noto.app`

**Статус:** Draft  
**Дата:** 2026-07-14

## Контекст

[ADR-002](../adr/002-routing-and-domains.md) принял:

- Сейчас: один Next.js app на `noto.app`
- Позже: публичные SEO-статьи на поддомене `blog.noto.app`

Детали миграции не проработаны.

## Варианты реализации

### A. Два Next.js app в monorepo

```
apps/web/     # noto.app — /app/*, лендинг
apps/blog/    # blog.noto.app — SEO-статьи
```

**Плюсы:** изоляция, независимый деплой, разный caching  
**Минусы:** дублирование UI (header/footer), два билда

### B. Один Next.js, routing по Host header

Middleware: `blog.noto.app` → rewrite на `/(public)/articles/*`

**Плюсы:** один codebase  
**Минусы:** сложнее конфиг, shared cache policies

### C. Статический генератор для blog

Next.js SSG / Astro / отдельный SSG только для статей.

**Плюсы:** максимальный SEO performance  
**Минусы:** ещё один стек или сложный pipeline

## Вопросы для проработки

- [ ] Общий дизайн между `noto.app` и `blog.noto.app`?
- [ ] Как публиковать: триггер из `apps/web` или отдельный API?
- [ ] URL статей: `/[slug]` на blog или `/articles/[slug]`?
- [ ] Sitemap, robots.txt, OG — на blog app
- [ ] Preview draft статьи перед публикацией — где живёт?
- [ ] CDN / ISR стратегия

## Текущее решение (до RFC)

Статьи рендерятся в `apps/web` route group `(public)` через RSC ([ADR-004](../adr/004-data-fetching.md)). Миграция не блокирует старт.

## Следующие шаги

1. Реализовать публикацию статей в monolith
2. Замерить SEO/performance потребности
3. Принять ADR о split когда появится >10 публичных страниц или отдельные требования к CDN

## Связанные документы

- [ADR-002](../adr/002-routing-and-domains.md)
- [ADR-004](../adr/004-data-fetching.md)
