// @vitest-environment jsdom
import type { Project } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { projectKeys } from './projects';
import { useProject } from './use-project';

type ProjectResponse = Awaited<ReturnType<typeof apiClient.projects.get>>;

const project: Project = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Мой проект',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

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

describe('useProject', () => {
  it('загружает проект и кэширует его под ключом детали', async () => {
    vi.spyOn(apiClient.projects, 'get').mockResolvedValue({
      status: 200,
      body: { project },
      headers: new Headers(),
    } satisfies ProjectResponse);
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useProject(project.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(project);
    expect(queryClient.getQueryData(projectKeys.detail(project.id))).toEqual(project);
  });

  it('резолвится в null для неизвестного id, не в ошибку', async () => {
    vi.spyOn(apiClient.projects, 'get').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Not found' },
      headers: new Headers(),
    } satisfies ProjectResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useProject(project.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });
});
