'use client';

import { Suspense } from 'react';

import { PageTrash } from '@/src/widgets/page-trash';

export default function TrashPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          Загрузка корзины…
        </p>
      }
    >
      <PageTrash />
    </Suspense>
  );
}
