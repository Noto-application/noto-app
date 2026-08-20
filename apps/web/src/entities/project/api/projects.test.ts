import { describe, expect, it } from 'vitest';

import { getProject, getProjects } from './projects';

describe('getProjects', () => {
  it('возвращает непустой список фикстур в форме Project', async () => {
    const projects = await getProjects();

    expect(projects.length).toBeGreaterThan(0);
    for (const project of projects) {
      expect(typeof project.id).toBe('string');
      expect(typeof project.name).toBe('string');
      expect(typeof project.createdAt).toBe('string');
      expect(typeof project.updatedAt).toBe('string');
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
