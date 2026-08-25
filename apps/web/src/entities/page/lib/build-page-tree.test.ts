import { describe, expect, it } from 'vitest';
import { buildPageTree, type PageTreeSource } from './build-page-tree';

const invalidPageLists: ReadonlyArray<{
  caseName: string;
  pages: PageTreeSource[];
}> = [
  {
    caseName: 'duplicate ids',
    pages: [
      { id: 'duplicate', parentId: null, position: 0, title: 'First' },
      { id: 'duplicate', parentId: null, position: 1, title: 'Second' },
    ],
  },
  {
    caseName: 'an orphan parent id',
    pages: [{ id: 'orphan', parentId: 'missing', position: 0, title: 'Orphan' }],
  },
  {
    caseName: 'a cycle',
    pages: [
      { id: 'first', parentId: 'second', position: 0, title: 'First' },
      { id: 'second', parentId: 'first', position: 0, title: 'Second' },
    ],
  },
  {
    caseName: 'a self-referencing cycle',
    pages: [{ id: 'self', parentId: 'self', position: 0, title: 'Self' }],
  },
];

describe('buildPageTree', () => {
  it('returns an empty tree for an empty list', () => {
    expect(buildPageTree([])).toEqual([]);
  });

  it('builds a nested tree when parents appear after their children', () => {
    const pages = [
      { id: 'child-later', parentId: 'root-a', position: 2, title: 'Child later' },
      { id: 'root-b', parentId: null, position: 10, title: 'Root B' },
      { id: 'grandchild', parentId: 'child-later', position: 0, title: 'Grandchild' },
      { id: 'child-earlier', parentId: 'root-a', position: 1, title: 'Child earlier' },
      { id: 'root-a', parentId: null, position: 2, title: 'Root A' },
    ];

    expect(buildPageTree(pages)).toEqual([
      {
        id: 'root-a',
        parentId: null,
        position: 2,
        title: 'Root A',
        children: [
          {
            id: 'child-earlier',
            parentId: 'root-a',
            position: 1,
            title: 'Child earlier',
            children: [],
          },
          {
            id: 'child-later',
            parentId: 'root-a',
            position: 2,
            title: 'Child later',
            children: [
              {
                id: 'grandchild',
                parentId: 'child-later',
                position: 0,
                title: 'Grandchild',
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'root-b',
        parentId: null,
        position: 10,
        title: 'Root B',
        children: [],
      },
    ]);
  });

  it('preserves API order for siblings with equal positions', () => {
    const pages = [
      { id: 'second', parentId: null, position: 0, title: 'Second' },
      { id: 'first', parentId: null, position: 0, title: 'First' },
      { id: 'child-second', parentId: 'first', position: 0, title: 'Child second' },
      { id: 'child-first', parentId: 'first', position: 0, title: 'Child first' },
    ];

    const tree = buildPageTree(pages);

    expect(tree.map((page) => page.id)).toEqual(['second', 'first']);
    expect(tree[1]?.children.map((page) => page.id)).toEqual(['child-second', 'child-first']);
  });

  it('does not mutate the input list or its page objects', () => {
    const pages = [
      { id: 'root-later', parentId: null, position: 10, title: 'Root later' },
      { id: 'child', parentId: 'root', position: 0, title: 'Child' },
      { id: 'root', parentId: null, position: 0, title: 'Root' },
    ];
    const originalPages = pages.map((page) => ({ ...page }));
    const originalOrder = pages.map((page) => page.id);

    buildPageTree(pages);

    expect(pages).toEqual(originalPages);
    expect(pages.map((page) => page.id)).toEqual(originalOrder);
    expect(pages.every((page) => !('children' in page))).toBe(true);
  });

  for (const { caseName, pages } of invalidPageLists) {
    it(`throws for ${caseName}`, () => {
      expect(() => buildPageTree(pages)).toThrow();
    });
  }
});
