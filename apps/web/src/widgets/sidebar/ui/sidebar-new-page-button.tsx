import { Plus } from 'lucide-react';

import { Button } from '@/src/shared/ui/button';

/** Мутация создания страницы — FE-P2 (issue #54), пока визуальная заглушка. */
export function SidebarNewPageButton() {
  return (
    <Button className="w-full justify-start gap-2 px-2" variant="ghost" disabled>
      <Plus aria-hidden="true" />
      Новая страница
    </Button>
  );
}
