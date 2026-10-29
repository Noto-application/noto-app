const AVATAR_COLORS = [
  '#e11d48',
  '#db2777',
  '#9333ea',
  '#4f46e5',
  '#0284c7',
  '#0d9488',
  '#16a34a',
  '#ca8a04',
  '#ea580c',
];

/**
 * Цвет-заглушка аватара, детерминированный по `id` (issue #127) — не по
 * отображаемому имени, чтобы не менялся при переименовании (#125). Тот же
 * алгоритм, что у `deriveCollabUser` в `widgets/editor/lib/collab-user.ts`.
 */
export function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
