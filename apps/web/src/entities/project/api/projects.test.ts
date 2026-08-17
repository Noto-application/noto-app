import { describe, expect, it } from 'vitest';

import { getProject, getProjects } from './projects';

describe('getProjects', () => {
  it('возвращает непустой список фикстур в форме Project', async () => {
    const projects = await getProjects();

    expect(projects.length).toBeGreaterThan(0);
    for (const project of projects) {
      expect(project).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    }
  });
});

describe('getProject', () => {
  it('возвращает проект с совпадающим id', async () => {
    const [target] = await getProjects();

    const project = await getProject(target.id);

    expect(project).toEqual(target);
  });

  it('возвращает undefined для неизвестного id', async () => {
    const project = await getProject('unknown-id');

    expect(project).toBeUndefined();
  });
});
