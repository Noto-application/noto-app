import * as React from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

import { cn } from '@/src/shared/lib/utils';

interface SidebarTreeItemProps {
  title: string;
  depth: number;
  isActive: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}

function SidebarTreeItem({
  title,
  depth,
  isActive,
  hasChildren,
  isExpanded,
  icon,
  onClick,
}: SidebarTreeItemProps) {
  const Icon = icon ?? <FileText />;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingLeft: `${depth * 12}px` }}
      className={cn(
        'flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm',
        'text-muted-foreground',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive && 'bg-accent text-accent-foreground',
      )}
    >
      {hasChildren ? (
        isExpanded ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )
      ) : (
        <span className="size-4 shrink-0" />
      )}

      <span className="size-4 shrink-0">{Icon}</span>

      <span className="min-w-0 truncate text-left">{title}</span>
    </button>
  );
}

export { SidebarTreeItem };
