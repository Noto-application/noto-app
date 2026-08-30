// @vitest-environment jsdom
import type { Project } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { projectKeys } from './projects';
import { useProjects } from './use-projects';

type ProjectsResponse = Awaited<ReturnType<typeof apiClient.projects.list>>;

const projects: Project[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Мой проект',
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useProjects', () => {
  it('загружает проекты и кэширует их под ключом списка', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(projects);
    expect(queryClient.getQueryData(projectKeys.all())).toEqual(projects);
  });
});
