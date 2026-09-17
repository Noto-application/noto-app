import type { Page } from '@noto/shared';

/** Возвращает позицию для добавления страницы в конец целевой группы. */
export function getMovePageAppendPosition(
  pages: readonly Page[],
  parentId: string | null,
  movingPageId: string,
) {
  return (
    Math.max(
      -1,
      ...pages
        .filter((page) => page.parentId === parentId && page.id !== movingPageId)
        .map((page) => page.position),
    ) + 1
  );
}
