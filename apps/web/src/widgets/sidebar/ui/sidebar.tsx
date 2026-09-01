'use client';

import Link from 'next/link';
import { Calendar, Inbox, Search, Settings, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';

import { usePage } from '@/src/entities/page';
import { cn } from '@/src/shared/lib/utils';
import { useSidebarStore } from '../model/use-sidebar-store';
import { PageTree } from './page-tree';
import { SidebarNavItem } from './sidebar-nav-item';
import { SidebarNewPageButton } from './sidebar-new-page-button';
import { SidebarUserBlock } from './sidebar-user-block';
import { SidebarWorkspaceSwitcher } from './sidebar-workspace-switcher';

/**
 * `projectId` дерева берётся из метаданных открытой страницы, не из URL
 * (ADR-002). Пока их нет — места дерева занимает распорка.
 */
function SidebarPageTree({ pageId }: { pageId: string }) {
  const { data: page } = usePage(pageId);

  if (!page) return <div className="flex-1" />;

  return <PageTree projectId={page.projectId} />;
}

export function Sidebar() {
  const { pageId } = useParams<{ pageId?: string }>();
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
        <SidebarWorkspaceSwitcher />

        <nav className="flex flex-col gap-0.5">
          <Link
            href="/app"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-body-compact text-foreground hover:bg-surface-hover"
          >
            <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
              <Home />
            </span>
            <span className="flex-1 truncate text-left">Домой</span>
          </Link>
        <nav aria-label="Разделы" className="flex flex-col gap-0.5">
          <SidebarNavItem icon={<Search />} label="Поиск" shortcut="⌘K" />
          <SidebarNavItem icon={<Inbox />} label="Входящие" />
          <SidebarNavItem icon={<Calendar />} label="Календарь" />
        </nav>

        {pageId ? <SidebarPageTree pageId={pageId} /> : <div className="flex-1" />}

        <div className="flex flex-col gap-0.5 border-t border-border pt-1">
          <SidebarNewPageButton />
          <SidebarNavItem icon={<Trash2 />} label="Корзина" />
          <SidebarNavItem icon={<Settings />} label="Настройки" />
        </div>

        <SidebarUserBlock />
      </aside>
    </>
  );
}
