import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/src/shared/lib/utils';

type SidebarNavItemProps = ComponentProps<'button'> & {
  icon: ReactNode;
  label: string;
  /** Подсказка-шорткат справа (например «⌘K» у поиска). */
  shortcut?: string;
};

/**
 * Строка навигации сайдбара без собственной логики — переиспользуется для
 * пунктов-заглушек (Поиск, Входящие, Календарь, Корзина, Настройки), пока у
 * них нет реального назначения (issue #19, вне scope).
 */
export function SidebarNavItem({
  icon,
  label,
  shortcut,
  className,
  disabled = true,
  ...props
}: SidebarNavItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-body-compact text-foreground',
        'hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {shortcut ? <span className="text-label text-muted-foreground">{shortcut}</span> : null}
    </button>
  );
}
