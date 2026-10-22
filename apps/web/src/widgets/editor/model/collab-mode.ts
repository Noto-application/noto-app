import type { Page } from '@noto/shared';

/**
 * Флаг спайка collab-режима (#110). Пользовательское включение — только после
 * #109 (persistence) + durable per-page признака (см. collab-editing.spec.md).
 */
export function isCollabEnabled(): boolean {
  return process.env.NEXT_PUBLIC_COLLAB_ENABLED === 'true';
}

/**
 * Выбор режима (#110): durable-признак `editorMode === 'collab'` — страница уже
 * живёт в Yjs и открывается так всегда, независимо от роли, флага и
 * REST-контента. Viewer подключается к ней только для чтения. Для viewer
 * REST-страницы collab не включается даже по спайк-флагу: internal endpoint
 * запрещает такое подключение. Для остальных спайк включает collab только при
 * поднятом флаге и пустой (новой/тестовой) странице.
 * Отсутствующий `editorMode` (до #109) ведёт себя как `rest`.
 */
export function shouldUseCollab(params: {
  enabled: boolean;
  editorMode?: Page['editorMode'];
  currentUserRole?: Page['currentUserRole'];
  content: Page['content'];
}): boolean {
  // Durable collab-страницы доступны viewer в read-only режиме. Для REST-страниц
  // viewer не подключаем к collab даже при включённом спайке: сервер ответит 403.
  if (params.editorMode === 'collab') {
    return true;
  }

  if (params.currentUserRole === 'viewer') {
    return false;
  }

  return params.enabled && params.content.length === 0;
}
