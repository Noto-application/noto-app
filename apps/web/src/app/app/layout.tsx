'use client';

import type { ReactNode } from 'react';

import { CreatePageProvider, useCreatePageAction } from '@/src/features/create-page';
import { QueryProvider } from '@/src/shared/api';
import { ErrorBoundary } from '@/src/shared/ui/error-boundary';
import { InlineAlert } from '@/src/shared/ui/inline-alert';
import { Sidebar, useSidebarStore } from '@/src/widgets/sidebar';
import { Topbar } from '@/src/widgets/topbar';
import { Toaster } from '@/src/shared/ui/toast';

// Sidebar/Topbar рендерятся в layout, а не в children — error.tsx сегмента их
// не ловит (это часть API Next.js: error-boundary сегмента не покрывает
// layout.tsx того же уровня, чтобы навигация оставалась видна при падении
// соседней страницы). Точечный ErrorBoundary — тот же класс, что уже
// защищает PageEditor (#94).
function SidebarErrorFallback() {
  return (
    <aside className="flex h-dvh w-64 shrink-0 items-center justify-center border-r border-border bg-surface p-4 text-center text-body-compact text-muted-foreground">
      Не удалось загрузить боковую панель
    </aside>
  );
}

function TopbarErrorFallback() {
  return (
    <div className="flex h-12 shrink-0 items-center justify-center border-b border-border px-3 text-body-compact text-muted-foreground">
      Не удалось загрузить верхнюю панель
    </div>
  );
}

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
  const { isProjectsError } = useCreatePageAction();

  return (
    <div className="flex h-dvh">
      <ErrorBoundary fallback={<SidebarErrorFallback />}>
        <Sidebar />
      </ErrorBoundary>
      <div className="flex min-w-0 flex-1 flex-col">
        <ErrorBoundary fallback={<TopbarErrorFallback />}>
          <Topbar breadcrumbs={[]} onOpenDrawer={() => setDrawerOpen(true)} />
        </ErrorBoundary>
        {isProjectsError ? (
          <InlineAlert className="mx-4 mt-2" variant="danger">
            Не удалось загрузить проекты. Попробуйте обновить страницу.
          </InlineAlert>
        ) : null}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <QueryProvider>
      <CreatePageProvider>
        <Toaster />
        <AppShell>{children}</AppShell>
      </CreatePageProvider>
    </QueryProvider>
  );
}
