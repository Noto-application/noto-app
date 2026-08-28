// @vitest-environment jsdom
import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import PageRoute from './page';

type PageResponse = Awaited<ReturnType<typeof apiClient.pages.get>>;

const pageId = '00000000-0000-4000-8000-000000000001';

const page: Page = {
  id: pageId,
  projectId: '00000000-0000-4000-8000-000000000002',
  parentId: null,
  title: 'Обзор проекта',
  content: [],
  position: 0,
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

vi.mock('next/navigation', () => ({
  useParams: () => ({ pageId }),
}));

function renderRoute() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <PageRoute />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** Маппинг статусов покрыт в `pages.test.ts` и `use-page.test.tsx`. Здесь
 *  только связка ветки с разметкой; успешный случай — против тавтологии. */
describe('роут /app/[pageId]', () => {
  it('показывает «Страница не найдена», когда страницы нет', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Not found' },
      headers: new Headers(),
    } satisfies PageResponse);

    renderRoute();

    expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/app');
  });

  it('показывает заголовок страницы, когда запрос удался', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 200,
      body: { page },
      headers: new Headers(),
    } satisfies PageResponse);

    renderRoute();

    expect(await screen.findByRole('heading', { name: page.title })).toBeInTheDocument();
    expect(screen.queryByText('Страница не найдена')).not.toBeInTheDocument();
  });
});
