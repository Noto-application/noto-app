import type { Page } from '@noto/shared';

export type PageTreeSource = Pick<Page, 'id' | 'parentId' | 'position' | 'title'>;

export type PageTreeNode = PageTreeSource & {
  children: PageTreeNode[];
};

export function buildPageTree(_pages: readonly PageTreeSource[]): PageTreeNode[] {
  throw new Error('buildPageTree is not implemented');
}
