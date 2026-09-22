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
 * живёт в Yjs и открывается так всегда, независимо от флага и REST-контента.
 * Иначе спайк-эвристика: collab только при поднятом флаге и пустой
 * (новой/тестовой) странице — чтобы не открыть сохранённый REST-контент пустым.
 * Отсутствующий `editorMode` (до #109) ведёт себя как `rest`.
 */
export function shouldUseCollab(params: {
  enabled: boolean;
  editorMode?: Page['editorMode'];
  content: Page['content'];
}): boolean {
  return params.editorMode === 'collab' || (params.enabled && params.content.length === 0);
}
