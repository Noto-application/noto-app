import type { CreatePageInput, Page, UpdatePageInput } from '@noto/shared';

import { apiClient, toApiClientError } from '@/src/shared/api';

export const pageKeys = {
  list: (projectId: string) => ['pages', 'list', projectId] as const,
  detail: (id: string) => ['pages', 'detail', id] as const,
};

export async function getPagesList(projectId: string): Promise<Page[]> {
  const response = await apiClient.pages.list({ params: { projectId } });

  if (response.status !== 200) {
    throw toApiClientError(response.body);
  }

  return response.body.pages;
}

export async function getPage(id: string): Promise<Page | undefined> {
  const response = await apiClient.pages.get({ params: { pageId: id } });

  if (response.status === 404) {
    return undefined;
  }

  if (response.status !== 200) {
    throw toApiClientError(response.body);
  }

  return response.body.page;
}

export async function createPage(projectId: string, input: CreatePageInput): Promise<Page> {
  const response = await apiClient.pages.create({
    params: { projectId },
    body: input,
  });

  if (response.status !== 201) {
    throw toApiClientError(response.body);
  }

  return response.body.page;
}

export async function updatePage(id: string, input: UpdatePageInput): Promise<Page> {
  const response = await apiClient.pages.update({
    params: { pageId: id },
    body: input,
  });

  if (response.status !== 200) {
    throw toApiClientError(response.body);
  }

  return response.body.page;
}

export async function deletePage(id: string): Promise<void> {
  const response = await apiClient.pages.delete({ params: { pageId: id } });

  if (response.status !== 204) {
    throw toApiClientError(response.body);
  }
}
