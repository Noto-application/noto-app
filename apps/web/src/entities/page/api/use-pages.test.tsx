// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { getPagesByProject } from './pages';
import { usePages } from './use-pages';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('usePages', () => {
  it('резолвится теми же данными, что и getPagesByProject', async () => {
    const { result } = renderHook(() => usePages('project-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(await getPagesByProject('project-1'));
  });

  it('резолвится в пустой список для проекта без страниц', async () => {
    const { result } = renderHook(() => usePages('a-project-id-with-no-pages'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});
