import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Бейдж по Design System (Figma «NoTo» → Components → Badge, узел 1:1766).
 *
 * Имена вариантов — по смыслу UI (`info`/`success`/`danger`/`warning`), не по
 * статусам продукта из макета («в работе», «готово»): набор статусов ещё
 * будет расти, а токены под конкретный статус переживут его переименование.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-caption font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface text-muted-foreground',
        info: 'border-status-info-border bg-status-info-bg text-status-info-text',
        success: 'border-status-success-border bg-status-success-bg text-status-success-text',
        danger: 'border-status-danger-border bg-status-danger-bg text-status-danger-text',
        warning: 'border-status-warning-border bg-status-warning-bg text-status-warning-text',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
