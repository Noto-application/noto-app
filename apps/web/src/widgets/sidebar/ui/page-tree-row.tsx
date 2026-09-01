import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/src/shared/lib/utils';

type BranchState = { hasChildren: false } | { hasChildren: true; isExpanded: boolean };

type PageTreeRowProps = BranchState & {
  title: string;
  href: string;
  depth: number;
  isActive: boolean;
  onToggle?: () => void;
};

/**
 * Временная строка дерева. `SidebarTreeItem` из `shared/ui` (#62) ещё не готов:
 * там вся строка — одна кнопка, без ссылки и отдельного шеврона. Разметка здесь
 * держит контракт [sidebar-tree-item.spec.md](../../../shared/ui/sidebar-tree-item.spec.md),
 * чтобы подмена свелась к замене импорта.
 */
export function PageTreeRow({ title, href, depth, isActive, ...branch }: PageTreeRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md pr-1 text-body-compact text-foreground',
        'hover:bg-surface-hover has-[[aria-current=page]]:bg-surface-selected',
      )}
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      {branch.hasChildren ? (
        <button
          type="button"
          aria-expanded={branch.isExpanded}
          aria-label={`${branch.isExpanded ? 'Свернуть' : 'Развернуть'} «${title}»`}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-surface-selected [&_svg]:size-4"
          onClick={branch.onToggle}
        >
          {branch.isExpanded ? <ChevronDown /> : <ChevronRight />}
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}

      <Link
        href={href}
        aria-current={isActive ? 'page' : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5"
      >
        <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
          <FileText />
        </span>
        <span className="truncate">{title}</span>
      </Link>

      {/* Слот действий: наполняется в задаче создания страницы и в FE-P3/P5. */}
      <span className="size-5 shrink-0" />
    </div>
  );
}
