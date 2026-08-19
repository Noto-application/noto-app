import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/src/shared/ui/button';

export function TopbarMenu() {
  return (
    <Button aria-label="Меню страницы" size="icon" variant="ghost" disabled>
      <MoreHorizontal aria-hidden="true" />
    </Button>
  );
}
