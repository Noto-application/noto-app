import type { Page } from '@noto/shared';
import { describe, expect, it } from 'vitest';

import { filterMovePageCandidates } from './filter-move-page-candidates';

function page(id: string, parentId: string | null = null): Page {
  return {
    id,
    projectId: 'project-1',
    parentId,
    title: id,
    content: [],
    position: 0,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  };
}

describe('filterMovePageCandidates', () => {
  it('исключает перемещаемую страницу и всё её поддерево', () => {
    const pages = [
      page('root'),
      page('moving', 'root'),
      page('child', 'moving'),
      page('grandchild', 'child'),
      page('sibling', 'root'),
      page('other-root'),
    ];

    expect(filterMovePageCandidates(pages, 'moving').map(({ id }) => id)).toEqual([
      'root',
      'sibling',
      'other-root',
    ]);
  });

  it('у листа исключает только его самого', () => {
    const pages = [page('root'), page('leaf', 'root'), page('sibling', 'root')];

    expect(filterMovePageCandidates(pages, 'leaf').map(({ id }) => id)).toEqual([
      'root',
      'sibling',
    ]);
  });
});
