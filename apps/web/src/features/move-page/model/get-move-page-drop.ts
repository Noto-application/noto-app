import type { Page } from '@noto/shared';

import { filterMovePageCandidates } from './filter-move-page-candidates';
import { getMovePageAppendPosition } from './get-move-page-append-position';

export type MovePageDropPlacement = 'before' | 'after' | 'inside';

type MovePageDestination = {
  parentId: string | null;
  position: number;
};

/**
 * Возвращает целевые parentId и position для drop на страницу или рядом с ней.
 * Drop на страницу добавляет её последним ребёнком; зоны до/после меняют
 * порядок среди её соседей.
 */
export function getMovePageDrop(
  pages: readonly Page[],
  movingPageId: string,
  targetPageId: string,
  placement: MovePageDropPlacement,
): MovePageDestination | null {
  const targetPage = pages.find((page) => page.id === targetPageId);

  if (
    !targetPage ||
    !filterMovePageCandidates(pages, movingPageId).some((page) => page.id === targetPageId)
  ) {
    return null;
  }

  if (placement === 'inside') {
    return {
      parentId: targetPage.id,
      position: getMovePageAppendPosition(pages, targetPage.id, movingPageId),
    };
  }

  return {
    parentId: targetPage.parentId,
    position: targetPage.position + (placement === 'after' ? 1 : 0),
  };
}
