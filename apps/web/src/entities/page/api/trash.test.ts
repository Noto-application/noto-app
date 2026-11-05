import { describe, expect, it, vi, afterEach } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { getTrashPages, restorePage } from './trash';

const projectId = '00000000-0000-4000-8000-000000000001';
const pageId = '00000000-0000-4000-8000-000000000002';

afterEach(() => vi.restoreAllMocks());

describe('trash API adapters', () => {
  it('returns the page and opaque cursor without rebuilding the tree', async () => {
    const body = {
      pages: [
        {
          id: pageId,
          projectId,
          parentId: null,
          title: 'Deleted',
          position: 0,
          deletedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
      nextCursor: 'opaque-next',
    };
    const trash = vi
      .spyOn(apiClient.pages, 'trash')
      .mockResolvedValue({ status: 200, body, headers: new Headers() });

    await expect(
      getTrashPages(projectId, { limit: 50, cursor: 'opaque-current' }),
    ).resolves.toEqual(body);
    expect(trash).toHaveBeenCalledWith({
      params: { projectId },
      query: { limit: 50, cursor: 'opaque-current' },
    });
  });

  it.each([
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
  ] as const)('does not turn list %s into an empty trash', async (status, code) => {
    vi.spyOn(apiClient.pages, 'trash').mockResolvedValue({
      status,
      body: { code, message: 'Unavailable' },
      headers: new Headers(),
    });
    await expect(getTrashPages(projectId, { limit: 50 })).rejects.toMatchObject({ code });
  });

  it('posts restore without a body and returns the server page', async () => {
    const page = {
      id: pageId,
      projectId,
      parentId: null,
      title: 'Restored',
      position: 8,
      content: [],
      currentUserRole: 'editor' as const,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    };
    const restore = vi
      .spyOn(apiClient.pages, 'restore')
      .mockResolvedValue({ status: 200, body: { page }, headers: new Headers() });
    await expect(restorePage(pageId)).resolves.toEqual(page);
    expect(restore).toHaveBeenCalledWith({ params: { pageId } });
  });

  it.each([undefined, { blockedBy: { id: projectId, title: 'Deleted root' } }])(
    'preserves a restore conflict and its optional details',
    async (details) => {
      vi.spyOn(apiClient.pages, 'restore').mockResolvedValue({
        status: 409,
        body: { code: 'CONFLICT', message: 'Cannot restore', ...(details ? { details } : {}) },
        headers: new Headers(),
      });
      await expect(restorePage(pageId)).rejects.toMatchObject({ code: 'CONFLICT', details });
    },
  );

  it('propagates a network failure instead of reporting success', async () => {
    const error = new TypeError('Network unavailable');
    vi.spyOn(apiClient.pages, 'restore').mockRejectedValue(error);
    await expect(restorePage(pageId)).rejects.toBe(error);
  });
});
