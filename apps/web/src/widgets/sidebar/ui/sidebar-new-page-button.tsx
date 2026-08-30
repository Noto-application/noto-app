import { Plus } from 'lucide-react';

import { CreatePageButton, useCreatePageAction } from '@/src/features/create-page';

/** Доступная из любого маршрута точка входа в общую операцию создания. */
export function SidebarNewPageButton() {
  const { isProjectsError } = useCreatePageAction();

  if (isProjectsError) {
    return (
      <p className="px-2 py-1 text-label text-status-danger-text">Не удалось загрузить проекты.</p>
    );
  }

  return (
    <CreatePageButton className="w-full justify-start gap-2 px-2" variant="ghost">
      <Plus aria-hidden="true" />
      Новая страница
    </CreatePageButton>
  );
}
