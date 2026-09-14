import type { Page } from '@noto/shared';

/**
 * Флаг спайка collab-режима (#110). Пользовательское включение — только после
 * #109 (persistence) + durable per-page признака (см. collab-editing.spec.md).
 */
export function isCollabEnabled(): boolean {
  return process.env.NEXT_PUBLIC_COLLAB_ENABLED === 'true';
}

/**
 * Спайк-эвристика выбора режима: collab включаем только при поднятом флаге и на
 * пустой (новой/тестовой) странице — чтобы не открыть уже сохранённый
 * REST-контент пустым. Durable per-page признак придёт с #109.
 */
export function shouldUseCollab(params: { enabled: boolean; content: Page['content'] }): boolean {
  return params.enabled && params.content.length === 0;
}
