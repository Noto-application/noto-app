// Только внутренний путь: один ведущий `/`, не `//` и не `/\` — оба
// трактуются частью браузеров как protocol-relative URL (open redirect).
export function getSafeRedirectPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null;
  }

  return value;
}
