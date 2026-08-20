// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { getProject, getProjects } from './projects';
import { useProject } from './use-project';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useProject', () => {
  it('резолвится теми же данными, что и getProject для данного id', async () => {
    const [target] = await getProjects();

    const { result } = renderHook(() => useProject(target.id), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(await getProject(target.id));
  });

  it('резолвится в null для неизвестного id, не в ошибку', async () => {
    const { result } = renderHook(() => useProject('unknown-project-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });
});
