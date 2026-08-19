import { create } from 'zustand';

type SidebarState = {
  expandedProjectIds: Set<string>;
  toggleProject: (projectId: string) => void;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  expandedProjectIds: new Set(),
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
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
}));
