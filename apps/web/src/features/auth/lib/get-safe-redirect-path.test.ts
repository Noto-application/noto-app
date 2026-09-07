import { describe, expect, it } from 'vitest';

import { getSafeRedirectPath } from './get-safe-redirect-path';

describe('getSafeRedirectPath', () => {
  it('принимает внутренний путь', () => {
    expect(getSafeRedirectPath('/app/123')).toBe('/app/123');
  });

  it('отклоняет внешний абсолютный URL', () => {
    expect(getSafeRedirectPath('https://evil.example')).toBeNull();
  });

  it('отклоняет protocol-relative URL (//)', () => {
    expect(getSafeRedirectPath('//evil.example')).toBeNull();
  });

  it('отклоняет обход через обратный слэш (/\\)', () => {
    expect(getSafeRedirectPath('/\\evil.example')).toBeNull();
  });

  it('отклоняет null', () => {
    expect(getSafeRedirectPath(null)).toBeNull();
  });

  it('отклоняет пустую строку', () => {
    expect(getSafeRedirectPath('')).toBeNull();
  });
});
