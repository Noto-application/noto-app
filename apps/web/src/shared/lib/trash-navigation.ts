import { pagesContract } from '@noto/shared';

export function getTrashProjectId(value: string | null): string | null {
  const parsed = pagesContract.trash.pathParams.safeParse({ projectId: value });
  return parsed.success ? parsed.data.projectId : null;
}

export function getTrashHref(projectId?: string | null) {
  return projectId ? `/app/trash?projectId=${encodeURIComponent(projectId)}` : '/app/trash';
}
