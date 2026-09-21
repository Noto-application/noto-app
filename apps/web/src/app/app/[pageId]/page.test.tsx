// @vitest-environment jsdom
import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';
import type * as EditorWidget from '@/src/widgets/editor';

import PageRoute from './page';

type PageResponse = Awaited<ReturnType<typeof apiClient.pages.get>>;

const { pageEditorProps } = vi.hoisted(() => ({ pageEditorProps: vi.fn() }));

// Мокаем на границе виджета: реальный PageEditor тянет BlockNote/Yjs и здесь не
// нужен. PageTitle оставляем настоящим — на нём держатся существующие проверки.
vi.mock('@/src/widgets/editor', async (importOriginal) => {
  const actual = await importOriginal<typeof EditorWidget>();
  return {
    ...actual,
    PageEditor: (props: { pageId: string; content: unknown; editorMode?: string }) => {
      pageEditorProps(props);
      return <div data-testid="page-editor" />;
    },
  };
});

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
  pageEditorProps.mockClear();
});

/** Маппинг кода ошибки в HTTP-статус покрыт в `pages.test.ts` и
 *  `use-page.test.tsx`. Здесь — своя логика, которая нигде больше не
 *  проверяется: какие коды `MISSING_CODES` считаются «страницы нет», а
 *  какие ведут на «сервис недоступен», плюс связка веток с разметкой. */
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

  it('показывает «Страница не найдена» на чужой странице (403)', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
      headers: new Headers(),
    } satisfies PageResponse);

    renderRoute();

    expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
  });

  it('показывает «Страница не найдена» при некорректном pageId (400)', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 400,
      body: { code: 'VALIDATION_ERROR', message: 'Invalid id' },
      headers: new Headers(),
    } satisfies PageResponse);

    renderRoute();

    expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
  });

  it('показывает «Не удалось загрузить страницу» на прочих ошибках', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 500,
      body: { code: 'INTERNAL', message: 'Internal error' },
      headers: new Headers(),
    } satisfies PageResponse);

    renderRoute();

    expect(await screen.findByRole('heading', { name: 'Не удалось загрузить страницу' })).toBeInTheDocument();
    expect(screen.queryByText('Страница не найдена')).not.toBeInTheDocument();
  });

  it('показывает заголовок страницы, когда запрос удался', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 200,
      body: { page },
      headers: new Headers(),
    } satisfies PageResponse);

    renderRoute();

    expect(await screen.findByRole('textbox', { name: 'Заголовок страницы' })).toHaveValue(page.title);
    expect(screen.queryByText('Страница не найдена')).not.toBeInTheDocument();
  });

  it('передаёт editorMode загруженной страницы в PageEditor', async () => {
    const collabPage: Page = { ...page, editorMode: 'collab' };
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 200,
      body: { page: collabPage },
      headers: new Headers(),
    } satisfies PageResponse);

    renderRoute();

    expect(await screen.findByTestId('page-editor')).toBeInTheDocument();
    expect(pageEditorProps).toHaveBeenCalledWith(
      expect.objectContaining({ pageId, editorMode: 'collab' }),
    );
  });
});
