import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader } from 'lucide-react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Отдельный атом-спиннер (Figma «NoTo» → Components → Skeleton / Loading →
 * Spinner, узел 1:2222) — та же 8-лучевая иконка и `--animate-spinner`,
 * что уже используются внутри `Button` (`loading` проп), выделена в
 * переиспользуемый компонент для мест вне кнопки (пустые состояния списков,
 * инлайн-загрузка и т.п.).
 */
const spinnerVariants = cva('spinner animate-spinner text-muted-foreground', {
  variants: {
    size: {
      sm: 'size-4',
      default: 'size-5',
      lg: 'size-7',
    },
  },
  defaultVariants: { size: 'default' },
});

function Spinner({
  className,
  size,
  ...props
}: React.ComponentProps<typeof Loader> & VariantProps<typeof spinnerVariants>) {
  return (
    <Loader data-slot="spinner" aria-hidden="true" className={cn(spinnerVariants({ size }), className)} {...props} />
  );
}

export { Spinner };
