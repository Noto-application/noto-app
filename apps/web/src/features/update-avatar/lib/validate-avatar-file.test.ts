import { describe, expect, it } from 'vitest';

import { validateAvatarFile } from './validate-avatar-file';

function makeFile(type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], 'avatar', { type });
}

describe('validateAvatarFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('принимает %s в пределах 5 МБ', (type) => {
    expect(validateAvatarFile(makeFile(type, 1024))).toBeNull();
  });

  it('отклоняет неподдерживаемый формат', () => {
    expect(validateAvatarFile(makeFile('image/gif', 1024))).toBe(
      'Поддерживаются только изображения JPEG, PNG и WebP.',
    );
  });

  it('отклоняет файл больше 5 МБ', () => {
    expect(validateAvatarFile(makeFile('image/png', 5 * 1024 * 1024 + 1))).toBe(
      'Файл больше 5 МБ.',
    );
  });

  it('принимает файл ровно 5 МБ', () => {
    expect(validateAvatarFile(makeFile('image/png', 5 * 1024 * 1024))).toBeNull();
  });
});
