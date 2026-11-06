import type { ReactNode } from 'react';

import type { TrashPage } from '@/src/entities/page';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

export function TrashPageRow({ page, action }: { page: TrashPage; action: ReactNode }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-4 p-4">
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-body font-medium">{page.title || 'Без названия'}</h2>
        <p className="mt-1 text-body-compact text-muted-foreground">
          Удалена{' '}
          <time dateTime={page.deletedAt}>{dateFormatter.format(new Date(page.deletedAt))}</time>
        </p>
      </div>
      {action}
    </li>
  );
}
