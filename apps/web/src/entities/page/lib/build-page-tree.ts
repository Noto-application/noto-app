import type { Page } from '@noto/shared';

export type PageTreeSource = Pick<Page, 'id' | 'parentId' | 'position' | 'title'>;

export type PageTreeNode = PageTreeSource & {
  children: PageTreeNode[];
};

export function buildPageTree(pages: readonly PageTreeSource[]): PageTreeNode[] {
  const pagesById = new Map<string, PageTreeSource>();
  const inputOrderById = new Map<string, number>();

  for (const [index, page] of pages.entries()) {
    if (pagesById.has(page.id)) {
      throw new Error(`Duplicate page id: ${page.id}`);
    }

    pagesById.set(page.id, page);
    inputOrderById.set(page.id, index);
  }

  assertPageHierarchyIsValid(pages, pagesById);

  const nodesById = new Map<string, PageTreeNode>();

  for (const page of pages) {
    nodesById.set(page.id, { ...page, children: [] });
  }

  const roots: PageTreeNode[] = [];

  for (const page of pages) {
    const node = nodesById.get(page.id);

    if (!node) {
      throw new Error(`Page node was not created: ${page.id}`);
    }

    if (page.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodesById.get(page.parentId);

    if (!parent) {
      throw new Error(`Parent page not found: ${page.parentId}`);
    }

    parent.children.push(node);
  }

  sortTreeByPosition(roots, inputOrderById);

  return roots;
}

function assertPageHierarchyIsValid(
  pages: readonly PageTreeSource[],
  pagesById: ReadonlyMap<string, PageTreeSource>,
): void {
  for (const page of pages) {
    const visitedIds = new Set<string>();
    let currentPage: PageTreeSource | undefined = page;

    while (currentPage?.parentId !== null) {
      if (visitedIds.has(currentPage.id)) {
        throw new Error(`Page tree contains a cycle at: ${currentPage.id}`);
      }

      visitedIds.add(currentPage.id);
      currentPage = pagesById.get(currentPage.parentId);

      if (!currentPage) {
        throw new Error(`Parent page not found: ${page.parentId}`);
      }
    }
  }
}

function sortTreeByPosition(
  nodes: PageTreeNode[],
  inputOrderById: ReadonlyMap<string, number>,
): void {
  nodes.sort((first, second) => {
    const positionDifference = first.position - second.position;

    if (positionDifference !== 0) {
      return positionDifference;
    }

    return (inputOrderById.get(first.id) ?? 0) - (inputOrderById.get(second.id) ?? 0);
  });

  for (const node of nodes) {
    sortTreeByPosition(node.children, inputOrderById);
  }
}
