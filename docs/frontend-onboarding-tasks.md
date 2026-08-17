# Frontend: задачи для вкатывания

Три **простые и обособленные** задачи для новых участников команды. Цель —
пройти путь «ветка → PR → ревью» без погружения в API, auth и Pages CRUD.

**Общий скоуп:** только `apps/web/src/shared/ui/` + Storybook. Бэкенд, `/app`,
Query, FSD-слои выше `shared` — **не трогаем**.

**Трек:** A · UI-kit (как [FE-2](./frontend-track-split.md)), но с отдельными
номерами **FE-ONB-1…3**, чтобы не путать с основным спринтом.

## Перед стартом

```bash
pnpm install
pnpm --filter web storybook   # http://localhost:6006
pnpm --filter web lint
pnpm --filter web typecheck
```

**Образцы в коде:** `button.tsx` + `button.stories.tsx`, `empty-state.tsx`.

**Правила:**

- Цвета и отступы — **только токены** из `globals.css` / Design System, без
  произвольных `#hex` и `px` ([frontend-track-split.md](./frontend-track-split.md)).
- Пропсы — **shadcn-совместимые** (где применимо).
- Компонент + stories в одном PR; unit-тесты **не обязательны** на onboarding.
- Ветка латиницей, например `feat/web-onb-separator`.

---

## FE-ONB-1 · Separator

**Сложность:** ★☆☆ · **Файлы:** `separator.tsx`, `separator.stories.tsx`

Горизонтальный/вертикальный разделитель — самый простой первый PR.

### Scope

- Компонент `Separator` в `shared/ui/separator.tsx`.
- Ориентир — [shadcn Separator](https://ui.shadcn.com/docs/components/separator):
  prop `orientation`: `'horizontal' | 'vertical'` (default `'horizontal'`).
- Стили: `bg-border`, для horizontal — `h-px w-full`, для vertical — `h-full w-px`.
- Атрибут `data-slot="separator"`, `role="separator"`, `aria-orientation`.
- Storybook `UI/Separator`: horizontal между двумя блоками текста; vertical в
  flex-ряду; вариант внутри карточки с `border`.

### Вне scope

- Интеграция в sidebar/topbar (сделает FE-3 / FE-P2).

### Критерии приёмки

- [ ] Storybook: оба orientation, light + dark (переключатель темы).
- [ ] `pnpm --filter web lint` и `typecheck` проходят.
- [ ] Нет хардкода цветов вне токенов.

### Зависимости

Нет. Можно брать первой.

---

## FE-ONB-2 · Label

**Сложность:** ★★☆ · **Файлы:** `label.tsx`, `label.stories.tsx`

Подпись к полям форм. Пригодится для login/register (FE-4).

### Scope

- Компонент `Label` в `shared/ui/label.tsx`.
- Ориентир — [shadcn Label](https://ui.shadcn.com/docs/components/label):
  рендер `<label>`, проброс `htmlFor`, стандартные HTML-атрибуты.
- Типографика: `text-label text-foreground`; для disabled-состояния родителя —
  `group-data-[disabled=true]:opacity-50` или prop `disabled`.
- `data-slot="label"`.
- Storybook `UI/Label`:
  - одна подпись;
  - связка с `Input` (`htmlFor` + `id`);
  - связка с `Checkbox` / `RadioGroup` (как в их stories, но через `Label`);
  - disabled.

### Вне scope

- Страницы auth, React Hook Form — отдельно (FE-4).

### Критерии приёмки

- [ ] Клик по Label фокусирует связанное поле (story с Input).
- [ ] API совместим с shadcn Label (props, ref при необходимости).
- [ ] lint + typecheck зелёные.

### Зависимости

Нет. Параллельно с FE-ONB-1 (другие файлы → без конфликтов).

---

## FE-ONB-3 · SidebarTreeItem

**Сложность:** ★★☆ · **Файлы:** `sidebar-tree-item.tsx`, `sidebar-tree-item.stories.tsx`

**Один ряд** дерева страниц в сайдбаре — только вёрстка, без API и без логики
дерева. Нужен для FE-P2, но здесь изолирован в Storybook.

### Scope

- Компонент `SidebarTreeItem` — **presentational** (все данные через props).
- Пропсы (минимум):

  | Prop | Тип | Описание |
  | ---- | --- | -------- |
  | `title` | `string` | Название страницы |
  | `depth` | `number` | Уровень вложенности (0 = корень) → отступ слева |
  | `isActive` | `boolean` | Текущая страница — подсветка фона |
  | `hasChildren` | `boolean` | Есть дочерние — показать chevron |
  | `isExpanded` | `boolean` | Chevron вниз/вправо (если `hasChildren`) |
  | `icon` | `ReactNode` | Опционально; default — `FileText` из `lucide-react` |
  | `onClick` | `() => void` | Клик по строке |

- Отступ: `paddingLeft` от `depth` (например `depth * 12px` через токен/spacing,
  не магический hex).
- Состояния в stories: default, active, nested (depth 1–2), with children
  expanded/collapsed, длинный title с `truncate`.
- Story **«Mini tree»**: 4–5 `SidebarTreeItem` в колонке — имитация фрагмента
  сайдбара (без рекурсии, просто список в story).

### Вне scope

- Загрузка страниц, `buildPageTree`, роутинг, drag-and-drop.
- Рекурсивный компонент дерева — это FE-P2.

### Критерии приёмки

- [ ] Только `shared/ui/`, без импортов из `widgets/`, `features/`, `entities/`.
- [ ] Keyboard: строка — `<button type="button">` или элемент с `role="treeitem"`,
  видимый focus ring (`focus-visible:ring-*`).
- [ ] Stories покрывают active + nested + chevron.
- [ ] lint + typecheck зелёные.

### Зависимости

Нет. Желательно после FE-ONB-1/2 (опыт со stories), но не блокирует.

---

## Параллелизация

Три человека могут взять **FE-ONB-1 / 2 / 3 одновременно** — файлы не
пересекаются.

```
FE-ONB-1  separator.tsx
FE-ONB-2  label.tsx
FE-ONB-3  sidebar-tree-item.tsx
```

После мёржа onboarding-PR'ов компоненты подхватит основная команда:

- `Label` → FE-4 (формы auth);
- `Separator` → FE-3 (layout сайдбара);
- `SidebarTreeItem` → FE-P2 (дерево страниц).

---

## Ссылки

- [frontend-track-split.md](./frontend-track-split.md) — трек A · UI-kit
- [frontend-pages-crud-tasks.md](./frontend-pages-crud-tasks.md) — FE-P2 ждёт TreeItem
- [ADR-008](./adr/008-fsd-structure.md) — слой `shared/ui`
- [ADR-014](./adr/014-responsive-strategy.md) — брейкпоинты Tailwind
- [apps/web/README.md](../apps/web/README.md) — запуск и проверки
