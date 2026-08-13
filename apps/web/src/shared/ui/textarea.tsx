import * as React from 'react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Многострочное поле ввода по Design System (Figma «NoTo» → Components →
 * Textarea, узел 1:1710).
 *
 * В `@base-ui/react` нет отдельного примитива textarea — используем нативный
 * элемент, стилизованный теми же токенами, что и `Input`. Высота задана как
 * `min-h`, а не фиксированный `h`: в отличие от однострочного `Input`, поле
 * должно расти вместе с содержимым.
 *
 * Ошибка передаётся через `aria-invalid` (тот же контракт, что у `Input`).
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-[79px] w-full min-w-0 rounded-md border border-input bg-background px-3 py-1.75 text-body text-foreground transition-colors outline-none placeholder:text-foreground/50 focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/35 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/45',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
