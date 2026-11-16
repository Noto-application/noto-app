// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { Sidebar } from './sidebar';

const navigation = vi.hoisted(() => ({ pageId: undefined as string | undefined, search: '' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ pageId: navigation.pageId }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock('./page-tree', () => ({
  PageTree: ({ projectId }: { projectId: string }) => <div data-testid="tree">{projectId}</div>,
}));
vi.mock('./sidebar-new-page-button', () => ({ SidebarNewPageButton: () => null }));
vi.mock('./sidebar-user-block', () => ({ SidebarUserBlock: () => null }));

afterEach(() => vi.restoreAllMocks());
function setup() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Sidebar />
    </QueryClientProvider>,
  );
}
const projectId = '00000000-0000-4000-8000-000000000001';

describe('Sidebar trash navigation', () => {
  it('opens the trash of the current page project', async () => {
    navigation.pageId = 'page-1';
    navigation.search = '';
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 200,
      body: {
        page: {
          id: 'page-1',
          projectId,
          parentId: null,
          title: 'Note',
          position: 0,
          content: [],
          currentUserRole: 'owner',
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
        },
      },
      headers: new Headers(),
    });
    setup();
    expect(await screen.findByTestId('tree')).toHaveTextContent(projectId);
    expect(screen.getByRole('link', { name: 'Корзина' })).toHaveAttribute(
      'href',
      `/app/trash?projectId=${projectId}`,
    );
  });
  it('preserves the URL project and tree when no live page is open', () => {
    navigation.pageId = undefined;
    navigation.search = `projectId=${projectId}`;
    setup();
    expect(screen.getByTestId('tree')).toHaveTextContent(projectId);
    expect(screen.getByRole('link', { name: 'Корзина' })).toHaveAttribute(
      'href',
      `/app/trash?projectId=${projectId}`,
    );
  });
  it('offers project selection when there is no current project', () => {
    navigation.pageId = undefined;
    navigation.search = '';
    setup();
    expect(screen.getByRole('link', { name: 'Корзина' })).toHaveAttribute('href', '/app/trash');
    expect(screen.queryByTestId('tree')).not.toBeInTheDocument();
  });
});
