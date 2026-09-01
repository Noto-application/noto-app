import { Plus } from 'lucide-react';

import { CreatePageButton } from '@/src/features/create-page';

/** Доступная из любого маршрута точка входа в общую операцию создания. */
export function SidebarNewPageButton() {
  return (
    <CreatePageButton className="w-full justify-start gap-2 px-2" variant="ghost">
      <Plus aria-hidden="true" />
      Новая страница
    </CreatePageButton>
  );
}
