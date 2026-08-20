import { beforeEach, describe, expect, it } from 'vitest';

import { useSidebarStore } from './use-sidebar-store';

function resetStore() {
  useSidebarStore.setState({
    expandedProjectIds: new Set(),
    isDrawerOpen: false,
  });
}

describe('useSidebarStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('изначально ни один проект не раскрыт, drawer закрыт', () => {
    const state = useSidebarStore.getState();

    expect(state.expandedProjectIds.size).toBe(0);
    expect(state.isDrawerOpen).toBe(false);
  });

  it('toggleProject раскрывает проект, если он был свёрнут', () => {
    useSidebarStore.getState().toggleProject('project-1');

    expect(useSidebarStore.getState().expandedProjectIds.has('project-1')).toBe(true);
  });

  it('toggleProject сворачивает проект обратно при повторном вызове', () => {
    useSidebarStore.getState().toggleProject('project-1');
    useSidebarStore.getState().toggleProject('project-1');

    expect(useSidebarStore.getState().expandedProjectIds.has('project-1')).toBe(false);
  });

  it('toggleProject не трогает состояние других уже раскрытых проектов', () => {
    useSidebarStore.getState().toggleProject('project-1');
    useSidebarStore.getState().toggleProject('project-2');
    useSidebarStore.getState().toggleProject('project-2');

    const { expandedProjectIds } = useSidebarStore.getState();
    expect(expandedProjectIds.has('project-1')).toBe(true);
    expect(expandedProjectIds.has('project-2')).toBe(false);
  });

  it('setDrawerOpen выставляет isDrawerOpen в переданное значение', () => {
    useSidebarStore.getState().setDrawerOpen(true);
    expect(useSidebarStore.getState().isDrawerOpen).toBe(true);

    useSidebarStore.getState().setDrawerOpen(false);
    expect(useSidebarStore.getState().isDrawerOpen).toBe(false);
  });
});
