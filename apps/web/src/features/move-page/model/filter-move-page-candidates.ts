import type { Page } from '@noto/shared';

/** Возвращает страницы, которые могут стать новым родителем. */
export function filterMovePageCandidates(pages: readonly Page[], movingPageId: string): Page[] {
  const childIdsByParentId = new Map<string, string[]>();

  for (const page of pages) {
    if (page.parentId === null) continue;

    const childIds = childIdsByParentId.get(page.parentId) ?? [];
    childIds.push(page.id);
    childIdsByParentId.set(page.parentId, childIds);
  }

  const excludedIds = new Set([movingPageId]);
  const idsToVisit = [movingPageId];

  while (idsToVisit.length > 0) {
    const parentId = idsToVisit.pop()!;

    for (const childId of childIdsByParentId.get(parentId) ?? []) {
      if (excludedIds.has(childId)) continue;

      excludedIds.add(childId);
      idsToVisit.push(childId);
    }
  }

  return pages.filter((page) => !excludedIds.has(page.id));
}
