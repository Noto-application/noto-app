import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/src/shared/lib/utils';

type TreeItemProps = Readonly<{
  depth?: 0 | 1 | 2;
  expanded?: boolean;
  leaf?: boolean;
  active?: boolean;
  children: ReactNode;
}>;

const DEPTH_PADDING = ['pl-2', 'pl-6', 'pl-10'] as const;

/** Строка дерева страниц в макете — визуальная копия, без логики сайдбара. */
export function MockTreeItem({ depth = 0, expanded, leaf, active, children }: TreeItemProps) {
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md py-1 pr-2',
        DEPTH_PADDING[depth],
        active && 'bg-surface-selected font-medium',
      )}
    >
      <span className="flex size-3.5 items-center justify-center text-muted-foreground">
        {!leaf && <Chevron className="size-3" />}
      </span>
      {children}
    </div>
  );
}

type TodoProps = Readonly<{ done?: boolean; children: ReactNode }>;

export function MockTodo({ done, children }: TodoProps) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-sm border',
          done ? 'border-primary bg-primary text-primary-foreground' : 'border-control-border',
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className={cn(done && 'text-muted-foreground line-through')}>{children}</span>
    </div>
  );
}

/**
 * Макет окна приложения для hero: сайдбар с деревом и открытая страница.
 * Свёрстан разметкой (не скриншот), поэтому следует теме и токенам.
 */
export function AppPreview() {
  return (
    <div
      role="img"
      aria-label="Интерфейс Noto: дерево страниц в сайдбаре и открытая страница с задачами"
      className="overflow-hidden rounded-xl border bg-background text-left shadow-lg"
    >
      <div className="flex h-10 items-center gap-3 border-b bg-surface px-3.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </div>
        <div className="mx-auto w-full max-w-sm truncate rounded-md border bg-background px-2.5 py-0.5 text-center font-mono text-caption text-muted-foreground">
          noto.app/app/<span className="text-foreground">k7f2m9q1</span>
        </div>
        <span className="w-12" />
      </div>

      <div className="grid min-h-96 md:grid-cols-[240px_1fr]">
        <aside className="hidden border-r bg-surface p-2 text-body md:block">
          <div className="mb-2 flex items-center gap-2 px-2 py-1.5 font-semibold">
            <span className="flex size-5 items-center justify-center rounded-sm bg-foreground text-caption text-background">
              К
            </span>
            Команда Noto
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground">
            <Search className="size-3.5" />
            Поиск
          </div>
          <div className="px-2 pt-3 pb-1 text-label text-muted-foreground">Проекты</div>
          <MockTreeItem expanded>Бэкенд</MockTreeItem>
          <MockTreeItem depth={1}>API-контракт</MockTreeItem>
          <MockTreeItem depth={1} leaf>
            Аутентификация
          </MockTreeItem>
          <MockTreeItem expanded>Фронтенд</MockTreeItem>
          <MockTreeItem depth={1} expanded>
            Лендинг
          </MockTreeItem>
          <MockTreeItem depth={2} leaf active>
            План на спринт
          </MockTreeItem>
          <MockTreeItem depth={2} leaf>
            Тексты
          </MockTreeItem>
          <MockTreeItem>Личное</MockTreeItem>
        </aside>

        <div className="max-w-2xl px-5 py-8 sm:px-12 sm:py-10">
          <div className="mb-6 text-body-compact text-muted-foreground">
            Фронтенд / Лендинг / План на спринт
          </div>
          <div className="mb-3 text-page-title sm:text-display">План на спринт</div>
          <p className="mb-5 text-body-lg">
            Собираем стартовую страницу: hero, фичи и roadmap. Всё в токенах дизайн-системы.
          </p>
          <div className="mb-2 text-heading-1">Задачи</div>
          <div className="text-body-lg">
            <MockTodo done>Согласовать структуру блоков</MockTodo>
            <MockTodo done>Написать тексты</MockTodo>
            <MockTodo>Сверстать hero</MockTodo>
            <MockTodo>Проверить на мобильных</MockTodo>
          </div>
        </div>
      </div>
    </div>
  );
}
