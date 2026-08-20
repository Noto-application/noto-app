import { TopbarBreadcrumbs, type BreadcrumbItem } from './topbar-breadcrumbs';
import { TopbarDrawerToggle } from './topbar-drawer-toggle';
import { TopbarMenu } from './topbar-menu';
import { TopbarPresence } from './topbar-presence';
import { TopbarPublishButton } from './topbar-publish-button';

type TopbarProps = {
  breadcrumbs: BreadcrumbItem[];
  onOpenDrawer: () => void;
};

export function Topbar({ breadcrumbs, onOpenDrawer }: TopbarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
      <TopbarDrawerToggle onOpenDrawer={onOpenDrawer} />
      <TopbarBreadcrumbs items={breadcrumbs} />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <TopbarPresence />
        <TopbarPublishButton />
        <TopbarMenu />
      </div>
    </header>
  );
}
