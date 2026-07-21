# ADR-004: Загрузка данных (RSC vs TanStack Query)

**Статус:** Accepted  
**Дата:** 2026-07-14

## Контекст

В приложении две зоны с разными требованиями: публичные страницы (SEO, SSR) и приватная SPA-like зона (редактор, realtime).

## Решение

### Публичная зона `(public)`

- **Server Components + prefetch** на сервере
- **TanStack Query не используется** на публичных страницах
- Подходит для: лендинг, login/register, SEO-статьи, OG-теги

```tsx
// Пример: apps/web/src/app/(public)/articles/[slug]/page.tsx
export default async function ArticlePage({ params }) {
  const article = await fetchArticle(params.slug); // RSC fetch
  return <ArticleView article={article} />;
}
```

### Приватная зона `/app/*`

- **Client Components + TanStack Query**
- Без RSC prefetch — SPA-like поведение
- Подходит для: проекты, страницы, поиск, корзина, настройки, история

### QueryClientProvider

- Живёт **только в `apps/web/src/app/app/layout.tsx`**
- Публичные страницы не оборачиваются в Query provider
- React Query Devtools — только в development, в layout `/app`

### Мутации

- Через TanStack Query `useMutation` + инвалидация кэша
- Server Actions как основной способ — **не используем** на старте

## Альтернативы

| Вариант                                    | Почему отклонён                             |
| ------------------------------------------ | ------------------------------------------- |
| TanStack Query везде                       | Избыточно для SEO-страниц; усложняет SSR    |
| RSC prefetch + dehydrate в Query на public | Усложнение без выгоды для статей            |
| Server Actions для мутаций                 | Не выбрано; REST API + Query проще с NestJS |

## Последствия

- Два паттерна fetch в одном приложении — задокументировать в onboarding
- API client для `/app` — отдельный модуль в `shared` или `apps/web/src/shared/api`
- `staleTime` / `gcTime` defaults — уточнить при инициализации (можно вынести в конфиг Query)

## Открытое (не блокирует старт)

- Конкретные значения `staleTime` для списка проектов vs метаданных страницы
- Prefetch критичных данных при входе в `/app` (опциональный гибрид позже)

## Связанные документы

- [ADR-005](./005-state-management.md) — что хранить в Query
- [RFC-001](../rfc/001-api-contract.md) — typed client/hooks из contract-first shared contracts (ts-rest)
