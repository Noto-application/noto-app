import { PanelLeft } from 'lucide-react';

import { Button } from '@/src/shared/ui/button';

type TopbarDrawerToggleProps = {
  onOpenDrawer: () => void;
};

/**
 * Открывает сайдбар-drawer под `lg` (ADR-014); на `lg+` не рендерится.
 *
 * Не читает useSidebarStore напрямую — это был бы импорт между виджетами
 * одного слоя (widgets/topbar → widgets/sidebar), запрещённый FSD (ADR-008).
 * Обработчик передаёт слой app/, которому виден и topbar, и sidebar.
 */
export function TopbarDrawerToggle({ onOpenDrawer }: TopbarDrawerToggleProps) {
  return (
    <Button
      aria-label="Открыть сайдбар"
      className="lg:hidden"
      size="icon"
      variant="ghost"
      onClick={onOpenDrawer}
    >
      <PanelLeft aria-hidden="true" />
    </Button>
  );
}
