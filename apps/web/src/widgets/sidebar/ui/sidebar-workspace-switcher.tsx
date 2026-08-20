import { ChevronsUpDown } from 'lucide-react';

import { Button } from '@/src/shared/ui/button';

export function SidebarWorkspaceSwitcher() {
  return (
    <Button
      className="w-full justify-between px-2"
      variant="ghost"
      disabled
      aria-label="Переключить рабочее пространство"
    >
      <span className="truncate text-body-compact font-medium">Noto</span>
      <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
    </Button>
  );
}
