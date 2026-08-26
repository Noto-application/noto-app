import type { CreatePageInput, Page, UpdatePageInput } from '@noto/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../shared/api';

import { createPage, deletePage, getPage, getPagesList, pageKeys, updatePage } from './pages';

const page: Page = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  parentId: null,
  title: 'Overview',
  content: [],
  position: 0,
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pageKeys', () => {
  it('creates the contract query keys', () => {
    expect(pageKeys.list('project-id')).toEqual(['pages', 'list', 'project-id']);
    expect(pageKeys.detail('page-id')).toEqual(['pages', 'detail', 'page-id']);
  });
});

describe('getPagesList', () => {
  it('returns pages from the successful API response', async () => {
    const list = vi.spyOn(apiClient.pages, 'list').mockResolvedValue({
      status: 200,
      body: { pages: [page] },
    } as never);

    await expect(getPagesList(page.projectId)).resolves.toEqual([page]);
    expect(list).toHaveBeenCalledWith({ params: { projectId: page.projectId } });
  });

  it('returns an empty list from a successful empty response', async () => {
    vi.spyOn(apiClient.pages, 'list').mockResolvedValue({
      status: 200,
      body: { pages: [] },
    } as never);

    await expect(getPagesList(page.projectId)).resolves.toEqual([]);
  });

  it('throws an API error for an unsuccessful response', async () => {
    vi.spyOn(apiClient.pages, 'list').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
    } as never);

    await expect(getPagesList(page.projectId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('getPage', () => {
  it('returns a page from the successful API response', async () => {
    const get = vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 200,
      body: { page },
    } as never);

    await expect(getPage(page.id)).resolves.toEqual(page);
    expect(get).toHaveBeenCalledWith({ params: { pageId: page.id } });
  });

  it('returns undefined for a missing page', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Not found' },
    } as never);

    await expect(getPage(page.id)).resolves.toBeUndefined();
  });

  it('throws an API error for responses other than 404', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
    } as never);

    await expect(getPage(page.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('mutation adapter stubs', () => {
  it('creates a page', async () => {
    const input: CreatePageInput = { title: 'New page' };
    const create = vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page },
    } as never);

    await expect(createPage(page.projectId, input)).resolves.toEqual(page);
    expect(create).toHaveBeenCalledWith({ params: { projectId: page.projectId }, body: input });
  });

  it('throws an API error when creating a page fails', async () => {
    vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
    } as never);

    await expect(createPage(page.projectId, { title: 'New page' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('updates a page', async () => {
    const input: UpdatePageInput = { title: 'Updated page' };
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue({
      status: 200,
      body: { page },
    } as never);

    await expect(updatePage(page.id, input)).resolves.toEqual(page);
    expect(update).toHaveBeenCalledWith({ params: { pageId: page.id }, body: input });
  });

  it('throws an API error when updating a page fails', async () => {
    vi.spyOn(apiClient.pages, 'update').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
    } as never);

    await expect(updatePage(page.id, { title: 'Updated page' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('deletes a page', async () => {
    const remove = vi.spyOn(apiClient.pages, 'delete').mockResolvedValue({
      status: 204,
      body: undefined,
    } as never);

    await expect(deletePage(page.id)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith({ params: { pageId: page.id } });
  });

  it('throws an API error when deleting a page fails', async () => {
    vi.spyOn(apiClient.pages, 'delete').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
    } as never);

    await expect(deletePage(page.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
