import type { User } from '@noto/shared';

// name/color + индексная сигнатура — под тип BlockNote `CollaborationUser`.
export interface CollabUser {
  name: string;
  color: string;
  [key: string]: string;
}

// Палитра CRDT-меток: различимые цвета, читаемые в light/dark.
const COLLAB_COLORS = [
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
 * Метка пользователя для Yjs-awareness (#110). Presence-курсоры вне scope, но
 * BlockNote требует `user`. Имя — из email (до `@`), цвет — детерминированно по
 * id, чтобы у одного пользователя цвет стабилен между сессиями.
 */
export function deriveCollabUser(user: Pick<User, 'id' | 'email'>): CollabUser {
  const name = user.email.split('@')[0] || user.email;
  return { name, color: colorForId(user.id) };
}

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}
