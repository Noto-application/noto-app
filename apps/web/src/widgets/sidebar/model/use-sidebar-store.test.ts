import { beforeEach, describe, expect, it } from 'vitest';

import { useSidebarStore } from './use-sidebar-store';

/** Восстановление целиком: перечисленные руками поля однажды забудут
 *  дополнить, и состояние потечёт между тестами. */
const initialState = useSidebarStore.getState();

function resetStore() {
  useSidebarStore.setState(initialState, true);
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

  /**
   * `collapsedPageIds` хранит свёрнутые узлы, а не раскрытые: дерево страниц по
   * умолчанию раскрыто целиком (page-tree.spec.md), поэтому пустое множество —
   * это «всё видно», в отличие от `expandedProjectIds`.
   */
  it('изначально ни одна страница не свёрнута', () => {
    expect(useSidebarStore.getState().collapsedPageIds.size).toBe(0);
  });

  it('togglePage сворачивает страницу, которая была раскрыта', () => {
    useSidebarStore.getState().togglePage('page-1');

    expect(useSidebarStore.getState().collapsedPageIds.has('page-1')).toBe(true);
  });

  it('togglePage раскрывает страницу обратно при повторном вызове', () => {
    useSidebarStore.getState().togglePage('page-1');
    useSidebarStore.getState().togglePage('page-1');

    expect(useSidebarStore.getState().collapsedPageIds.has('page-1')).toBe(false);
  });

  it('togglePage не трогает остальные свёрнутые страницы', () => {
    useSidebarStore.getState().togglePage('page-1');
    useSidebarStore.getState().togglePage('page-2');
    useSidebarStore.getState().togglePage('page-2');

    const { collapsedPageIds } = useSidebarStore.getState();
    expect(collapsedPageIds.has('page-1')).toBe(true);
    expect(collapsedPageIds.has('page-2')).toBe(false);
  });

  /** `togglePage` для раскрытия предков не годится: свернул бы те, что уже
   *  раскрыты. */
  it('expandPages убирает переданные страницы из свёрнутых', () => {
    useSidebarStore.setState({ collapsedPageIds: new Set(['page-1', 'page-2']) });

    useSidebarStore.getState().expandPages(['page-1', 'page-2']);

    expect(useSidebarStore.getState().collapsedPageIds.size).toBe(0);
  });

  it('expandPages не трогает страницы, которых нет в списке', () => {
    useSidebarStore.setState({ collapsedPageIds: new Set(['page-1', 'page-3']) });

    useSidebarStore.getState().expandPages(['page-1']);

    const { collapsedPageIds } = useSidebarStore.getState();
    expect(collapsedPageIds.has('page-1')).toBe(false);
    expect(collapsedPageIds.has('page-3')).toBe(true);
  });

  it('expandPages идемпотентен: раскрытие уже раскрытых ничего не меняет', () => {
    useSidebarStore.setState({ collapsedPageIds: new Set(['page-3']) });

    useSidebarStore.getState().expandPages(['page-1']);
    useSidebarStore.getState().expandPages(['page-1']);

    const { collapsedPageIds } = useSidebarStore.getState();
    expect(collapsedPageIds.has('page-1')).toBe(false);
    expect(collapsedPageIds.has('page-3')).toBe(true);
  });

  /** `toBe`, а не `toEqual`: новый `Set` с тем же содержимым Zustand считает
   *  изменением и перерисовывает подписчиков. */
  it('expandPages не трогает состояние, когда раскрывать нечего', () => {
    useSidebarStore.setState({ collapsedPageIds: new Set(['page-1']) });
    const before = useSidebarStore.getState().collapsedPageIds;

    useSidebarStore.getState().expandPages([]);
    expect(useSidebarStore.getState().collapsedPageIds).toBe(before);

    useSidebarStore.getState().expandPages(['page-2']);
    expect(useSidebarStore.getState().collapsedPageIds).toBe(before);
  });

  it('togglePage не пересекается с раскрытием проектов', () => {
    useSidebarStore.getState().togglePage('page-1');

    expect(useSidebarStore.getState().expandedProjectIds.size).toBe(0);
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
