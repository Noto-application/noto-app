// @vitest-environment jsdom
import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { Sidebar } from './sidebar';

const route = vi.hoisted(() => ({ pageId: undefined as string | undefined }));
vi.mock('next/navigation', () => ({ useParams: () => ({ pageId: route.pageId }) }));
// Не относящиеся к календарной ссылке ветви виджета не запускают свои запросы.
vi.mock('./page-tree', () => ({ PageTree: () => null }));
vi.mock('./sidebar-workspace-switcher', () => ({ SidebarWorkspaceSwitcher: () => null }));
vi.mock('./sidebar-user-block', () => ({ SidebarUserBlock: () => null }));
vi.mock('./sidebar-new-page-button', () => ({ SidebarNewPageButton: () => null }));

type PageResponse = Awaited<ReturnType<typeof apiClient.pages.get>>;
const page: Page = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  parentId: null,
  title: 'Open Page',
  content: [],
  position: 0,
  currentUserRole: 'owner',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};
const clients: QueryClient[] = [];
function renderSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <Sidebar />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  route.pageId = undefined;
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

describe('Sidebar calendar link — #135', () => {
  it.each(['owner', 'editor', 'viewer'] as const)(
    'carries the open Page project for %s without deriving project permissions',
    async (currentUserRole) => {
      route.pageId = page.id;
      vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
        status: 200,
        body: { page: { ...page, currentUserRole } },
        headers: new Headers(),
      } satisfies PageResponse);
      renderSidebar();
      await waitFor(() => {
        const url = new URL(
          screen.getByRole('link', { name: 'Календарь' }).getAttribute('href')!,
          'http://localhost',
        );
        expect(url.pathname).toBe('/app/calendar');
        expect(url.searchParams.get('projectId')).toBe(page.projectId);
      });
    },
  );

  it('links to canonical calendar resolution when there is no open Page', () => {
    const get = vi.spyOn(apiClient.pages, 'get');
    renderSidebar();
    const url = new URL(
      screen.getByRole('link', { name: 'Календарь' }).getAttribute('href')!,
      'http://localhost',
    );
    expect(url.pathname).toBe('/app/calendar');
    expect(url.searchParams.has('projectId')).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});
