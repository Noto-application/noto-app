import * as React from 'react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Плейсхолдер загрузки контента (Figma «NoTo» → Components → Skeleton /
 * Loading, узел 1:2208). Градиент muted → surface-hover → muted подразумевает
 * бегущий блик — сама анимация (`--animate-shimmer`) не задана в макете,
 * добавлена нами (см. globals.css).
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-shimmer rounded-[4px] bg-[length:200%_100%] bg-gradient-to-r from-muted via-surface-hover to-muted',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
