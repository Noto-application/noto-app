import type { ClientInferResponses } from '@ts-rest/core';
import type { pagesContract } from '@noto/shared';

import { apiClient, toApiClientError } from '@/src/shared/api';

export type TrashPagesResponse = ClientInferResponses<typeof pagesContract.trash, 200>['body'];
export type TrashPage = TrashPagesResponse['pages'][number];

export const trashKeys = {
  list: (projectId: string) => ['pages', 'trash', projectId] as const,
};

export async function getTrashPages(
  projectId: string,
  query: { limit: number; cursor?: string },
): Promise<TrashPagesResponse> {
  const response = await apiClient.pages.trash({ params: { projectId }, query });
  if (response.status !== 200) throw toApiClientError(response.body);
  return response.body;
}

export async function restorePage(pageId: string) {
  const response = await apiClient.pages.restore({ params: { pageId } });
  if (response.status !== 200) throw toApiClientError(response.body);
  return response.body.page;
}
