// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreatePageProvider } from '@/src/features/create-page';
import { apiClient } from '@/src/shared/api';

import AppPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('стартовый экран /app', () => {
  it('показывает сообщение вместо кнопки, если список проектов не загрузился', async () => {
    vi.spyOn(apiClient.projects, 'list').mockRejectedValue(new TypeError('Network error'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <CreatePageProvider>
          <AppPage />
        </CreatePageProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить проекты');
    expect(screen.queryByRole('button', { name: 'Создать страницу' })).not.toBeInTheDocument();
  });
});
