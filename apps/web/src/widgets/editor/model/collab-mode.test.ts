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
