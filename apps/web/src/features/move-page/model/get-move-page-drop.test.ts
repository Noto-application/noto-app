import type { Page } from '@noto/shared';
import { describe, expect, it } from 'vitest';

import { getMovePageDrop } from './get-move-page-drop';

function page(id: string, parentId: string | null = null, position = 0): Page {
  return {
    id,
    projectId: 'project-1',
    parentId,
    title: id,
    content: [],
    position,
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
  };
}

describe('getMovePageDrop', () => {
  const pages = [
    page('moving', 'parent', 0),
    page('before', 'parent', 1),
    page('after', 'parent', 2),
    page('new-parent'),
    page('existing-child', 'new-parent', 4),
    page('child', 'moving'),
  ];

  it('при drop на страницу добавляет её последним ребёнком', () => {
    expect(getMovePageDrop(pages, 'moving', 'new-parent', 'inside')).toEqual({
      parentId: 'new-parent',
      position: 5,
    });
  });

  it('вставляет страницу до или после указанного соседа', () => {
    expect(getMovePageDrop(pages, 'moving', 'before', 'before')).toEqual({
      parentId: 'parent',
      position: 1,
    });
    expect(getMovePageDrop(pages, 'moving', 'after', 'after')).toEqual({
      parentId: 'parent',
      position: 3,
    });
  });

  it('переносит страницу в корень при вставке рядом с корневой страницей', () => {
    expect(getMovePageDrop(pages, 'moving', 'new-parent', 'before')).toEqual({
      parentId: null,
      position: 0,
    });
  });

  it('блокирует drop на потомка независимо от позиции', () => {
    expect(getMovePageDrop(pages, 'moving', 'child', 'inside')).toBeNull();
    expect(getMovePageDrop(pages, 'moving', 'child', 'before')).toBeNull();
    expect(getMovePageDrop(pages, 'moving', 'child', 'after')).toBeNull();
  });
});
