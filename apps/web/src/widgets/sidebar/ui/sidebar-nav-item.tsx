import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/src/shared/lib/utils';

type SidebarNavItemProps = ComponentProps<'button'> & {
  icon: ReactNode;
  label: string;
  /** Подсказка-шорткат справа (например «⌘K» у поиска). */
  shortcut?: string;
  /** Если задан — пункт рендерится ссылкой `next/link`, а не `button`. */
  href?: string;
};

/**
 * Строка навигации сайдбара без собственной логики — переиспользуется для
 * пунктов-заглушек (Поиск, Входящие, Календарь, Корзина), пока у них нет
 * реального назначения (issue #19, вне scope). С `href` рендерится рабочей
 * ссылкой (так уже сделано «Настройки», issue #125).
 */
export function SidebarNavItem({
  icon,
  label,
  shortcut,
  href,
  className,
  disabled = true,
  ...props
}: SidebarNavItemProps) {
  const sharedClassName = cn(
    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-body-compact text-foreground',
    'hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50',
    className,
  );
  const content = (
    <>
      <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {shortcut ? <span className="text-label text-muted-foreground">{shortcut}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={sharedClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={sharedClassName} disabled={disabled} {...props}>
      {content}
    </button>
  );
}
