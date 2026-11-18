'use client';

import { Calendar, Home, Inbox, Search, Settings, Trash2 } from 'lucide-react';
import { Suspense } from 'react';

import { useProjectContext } from '@/src/features/create-page';
import { Button } from '@/src/shared/ui/button';
import { cn } from '@/src/shared/lib/utils';
import { useSidebarStore } from '../model/use-sidebar-store';
import { PageTree } from './page-tree';
import { SidebarNavItem } from './sidebar-nav-item';
import { SidebarNewPageButton } from './sidebar-new-page-button';
import { SidebarUserBlock } from './sidebar-user-block';
import { SidebarWorkspaceSwitcher } from './sidebar-workspace-switcher';

function SidebarContent() {
  const context = useProjectContext();
  const { projectId } = context;
  const href = (path: string) =>
    context.linksBlocked
      ? undefined
      : projectId
        ? `${path}?projectId=${encodeURIComponent(projectId)}`
        : path;
  const isDrawerOpen = useSidebarStore((state) => state.isDrawerOpen);
  const setDrawerOpen = useSidebarStore((state) => state.setDrawerOpen);

  return (
    <>
      {isDrawerOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'flex h-dvh w-64 shrink-0 flex-col gap-1 border-r border-border bg-surface p-2',
          'fixed inset-y-0 left-0 z-50 -translate-x-full transition-transform duration-200',
          'lg:static lg:translate-x-0',
          isDrawerOpen && 'translate-x-0',
        )}
      >
        <SidebarWorkspaceSwitcher context={context} />

        <nav aria-label="Разделы" className="flex flex-col gap-0.5">
          <SidebarNavItem icon={<Home />} label="Домой" href={href('/app')} />
          <SidebarNavItem icon={<Search />} label="Поиск" shortcut="⌘K" />
          <SidebarNavItem icon={<Inbox />} label="Входящие" />
          <SidebarNavItem icon={<Calendar />} label="Календарь" href={href('/app/calendar')} />
        </nav>

        {projectId ? (
          <PageTree projectId={projectId} />
        ) : (
          <div className="flex-1 p-2 text-body-compact" role="status">
            {
              (
                {
                  pending: 'Загрузка проекта…',
                  invalid: 'Невалидный проект',
                  forbidden: 'Доступ запрещён',
                  unavailable: 'Проект недоступен',
                  'page-missing': 'Страница недоступна',
                  error: 'Не удалось загрузить проект',
                  'no-projects': 'Нет проектов',
                  chooser: 'Выберите проект',
                  global: '',
                } as const
              )[context.status as Exclude<typeof context.status, 'ready'>]
            }
            {context.status === 'error' ? (
              <Button variant="ghost" onClick={context.retry}>
                Повторить
              </Button>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-0.5 border-t border-border pt-1">
          <SidebarNewPageButton />
          <SidebarNavItem icon={<Trash2 />} label="Корзина" href={href('/app/trash')} />
          <SidebarNavItem icon={<Settings />} label="Настройки" href="/app/settings" />
        </div>

        <SidebarUserBlock />
      </aside>
    </>
  );
}

export function Sidebar() {
  return (
    <Suspense
      fallback={<aside className="hidden w-64 shrink-0 lg:block" aria-label="Загрузка навигации" />}
    >
      <SidebarContent />
    </Suspense>
  );
}
