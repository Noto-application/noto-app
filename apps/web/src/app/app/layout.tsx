'use client';

import type { ReactNode } from 'react';

import { QueryProvider } from '@/src/shared/api';
import { Sidebar, useSidebarStore } from '@/src/widgets/sidebar';
import { Topbar } from '@/src/widgets/topbar';

type AppLayoutProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Собирает Sidebar и Topbar вместе — единственное место, которому по FSD
 * можно видеть оба виджета сразу (app-слой выше widgets). Хлебные крошки
 * пока пустые: подъём pageId → путь до страницы — FE-P1/FE-P3 (issue #53,
 * #55), не в scope этой задачи.
 */
function AppShell({ children }: AppLayoutProps) {
  const setDrawerOpen = useSidebarStore((state) => state.setDrawerOpen);

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar breadcrumbs={[]} onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <QueryProvider>
      <AppShell>{children}</AppShell>
    </QueryProvider>
  );
}
