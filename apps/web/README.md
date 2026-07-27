# @noto/web

Фронтенд Noto на Next.js (App Router), TypeScript и Tailwind CSS.

## Требования

- Node.js 24
- pnpm 11

## Локальный запуск

Все команды запускаются из корня монорепозитория.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter web dev
```

После запуска лендинг доступен по адресу [http://localhost:3000](http://localhost:3000).

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

Route group `(public)` содержит публичные страницы, а сегмент `app` — задел
под приватную часть по пути `/app/*`.
