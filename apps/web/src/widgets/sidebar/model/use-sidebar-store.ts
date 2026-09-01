import { create } from 'zustand';

type SidebarState = {
  expandedProjectIds: Set<string>;
  toggleProject: (projectId: string) => void;
  /**
   * Обратная полярность к `expandedProjectIds`: дерево страниц по умолчанию
   * раскрыто целиком, поэтому хранятся исключения (page-tree.spec.md).
   */
  collapsedPageIds: Set<string>;
  togglePage: (pageId: string) => void;
  /** Раскрытие предков активной страницы: `togglePage` не идемпотентен. */
  expandPages: (pageIds: string[]) => void;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  expandedProjectIds: new Set(),
  collapsedPageIds: new Set(),
  isDrawerOpen: false,
  toggleProject: (projectId) =>
    set((state) => {
      const expandedProjectIds = new Set(state.expandedProjectIds);

      if (expandedProjectIds.has(projectId)) {
        expandedProjectIds.delete(projectId);
      } else {
        expandedProjectIds.add(projectId);
      }

      return { expandedProjectIds };
    }),
  togglePage: (pageId) =>
    set((state) => {
      const collapsedPageIds = new Set(state.collapsedPageIds);

      if (collapsedPageIds.has(pageId)) {
        collapsedPageIds.delete(pageId);
      } else {
        collapsedPageIds.add(pageId);
      }

      return { collapsedPageIds };
    }),
  expandPages: (pageIds) =>
    set((state) => {
      // Возврат того же объекта — Zustand не уведомляет подписчиков: холостой
      // вызов не перерисует дерево и не закольцует эффект.
      if (!pageIds.some((pageId) => state.collapsedPageIds.has(pageId))) {
        return state;
      }

      const collapsedPageIds = new Set(state.collapsedPageIds);

      for (const pageId of pageIds) {
        collapsedPageIds.delete(pageId);
      }

      return { collapsedPageIds };
    }),
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
}));
