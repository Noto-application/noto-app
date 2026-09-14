'use client';

import dynamic from 'next/dynamic';

import { CollabSyncIndicator } from './sync-indicator';

/**
 * Client-only обёртка над collab-редактором (#110). `ssr: false` — провайдер
 * строится из `window.location`, на сервере рендерить нельзя. Тяжёлая
 * Yjs/BlockNote-цепочка грузится лениво, поэтому REST-режим её не тянет.
 */
export const CollabEditor = dynamic(
  () => import('./collab-editor-client').then((module) => module.CollabEditorClient),
  {
    ssr: false,
    loading: () => <CollabSyncIndicator status="connecting" />,
  },
);
