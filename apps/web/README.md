# @noto/web

Фронтенд Noto на Next.js (App Router), TypeScript и Tailwind CSS.

## Требования

- Node.js 24
- pnpm 11

## Локальный запуск

Все команды запускаются из корня монорепозитория. Полный локальный сценарий,
требования и настройка env — в [корневом README](../../README.md#быстрый-старт):

```bash
pnpm dev
```

После готовности приложений используйте [http://localhost:8080](http://localhost:8080)
(единый origin фронта, API и collab через Caddy).
Отдельный `pnpm --filter @noto/web dev` запускает только Next на `3000`, без
инфраструктуры, миграций и прокси; для API/collab подготовьте их самостоятельно.

## Проверки

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
```

## Структура

```text
src/
├── app/       # маршруты и layouts Next.js App Router
├── pages/     # FSD-композиция страниц, будет заполняться по мере роста
├── widgets/   # крупные UI-блоки
├── features/  # пользовательские сценарии
├── entities/  # бизнес-сущности
└── shared/    # переиспользуемые API, UI, утилиты, конфигурация и типы
```

Route group `(public)` содержит публичные страницы.
