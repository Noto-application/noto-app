import { describe, expect, it } from 'vitest';

import { getPage, getPagesByProject } from './pages';

describe('getPagesByProject', () => {
  it('возвращает только страницы, принадлежащие данному проекту', async () => {
    const pages = await getPagesByProject('project-1');

    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.projectId).toBe('project-1');
    }
  });

  it('возвращает пустой список для проекта без страниц', async () => {
    const pages = await getPagesByProject('a-project-id-with-no-pages');

    expect(pages).toEqual([]);
  });
});

describe('getPage', () => {
  it('возвращает страницу с совпадающим id', async () => {
    const [target] = await getPagesByProject('project-1');

    const page = await getPage(target.id);

    expect(page).toEqual(target);
  });

  it('возвращает undefined для неизвестного id', async () => {
    const page = await getPage('unknown-id');

    expect(page).toBeUndefined();
  });
});
