import { afterEach, describe, expect, it, vi } from 'vitest';

import { isCollabEnabled, shouldUseCollab } from './collab-mode';

describe('shouldUseCollab', () => {
  it('включает collab только при флаге и пустом контенте (новая страница)', () => {
    expect(shouldUseCollab({ enabled: true, content: [] })).toBe(true);
  });

  it('не включает при выключенном флаге, даже если страница пустая', () => {
    expect(shouldUseCollab({ enabled: false, content: [] })).toBe(false);
  });

  it('не включает на странице с REST-контентом (не открыть заметки пустыми)', () => {
    expect(shouldUseCollab({ enabled: true, content: [{ type: 'paragraph' }] })).toBe(false);
  });

  // Durable-признак (#109): страница, однажды переведённая в collab, всегда
  // открывается через Yjs — независимо от флага и от REST-контента.
  it('включает collab на durable collab-странице при выключенном флаге', () => {
    expect(shouldUseCollab({ enabled: false, editorMode: 'collab', content: [] })).toBe(true);
  });

  it('включает collab на durable collab-странице с непустым REST-контентом', () => {
    expect(
      shouldUseCollab({ enabled: false, editorMode: 'collab', content: [{ type: 'paragraph' }] }),
    ).toBe(true);
  });

  // Спайк-путь (#110) не должен утаскивать rest-страницу с контентом в collab.
  it('не включает collab на rest-странице с контентом даже при поднятом флаге', () => {
    expect(
      shouldUseCollab({ enabled: true, editorMode: 'rest', content: [{ type: 'paragraph' }] }),
    ).toBe(false);
  });

  it('включает collab по спайк-пути на rest-странице без контента при флаге', () => {
    expect(shouldUseCollab({ enabled: true, editorMode: 'rest', content: [] })).toBe(true);
  });

  it('не включает collab при выключенном флаге и editorMode rest', () => {
    expect(shouldUseCollab({ enabled: false, editorMode: 'rest', content: [] })).toBe(false);
  });
});

describe('isCollabEnabled', () => {
  const original = process.env.NEXT_PUBLIC_COLLAB_ENABLED;

  afterEach(() => {
    process.env.NEXT_PUBLIC_COLLAB_ENABLED = original;
    vi.unstubAllEnvs();
  });

  it('true только при строке "true"', () => {
    process.env.NEXT_PUBLIC_COLLAB_ENABLED = 'true';
    expect(isCollabEnabled()).toBe(true);
  });

  it('false при любом ином значении', () => {
    process.env.NEXT_PUBLIC_COLLAB_ENABLED = '1';
    expect(isCollabEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_COLLAB_ENABLED = undefined;
    expect(isCollabEnabled()).toBe(false);
  });
});
