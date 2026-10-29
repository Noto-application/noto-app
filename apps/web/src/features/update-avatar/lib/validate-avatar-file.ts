const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Issue #127: JPEG/PNG/WebP, до 5 МБ. Возвращает текст ошибки или `null`. */
export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Поддерживаются только изображения JPEG, PNG и WebP.';
  }

  if (file.size > MAX_SIZE_BYTES) {
    return 'Файл больше 5 МБ.';
  }

  return null;
}
