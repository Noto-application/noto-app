import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';

import { cn } from '@/src/shared/lib/utils';

/**
 * Поле ввода по Design System (Figma «NoTo» → Components → Поля ввода,
 * узел 1:1660).
 *
 * Ошибка передаётся через `aria-invalid` (стандарт shadcn), а не отдельным
 * пропом — так виджет остаётся совместим с shadcn-совместимыми обёртками
 * форм. Текст подсказки под полем («Обязательное поле» в макете) — не часть
 * этого атома, это забота будущего Field-компонента.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-9.25 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1.75 text-body text-foreground transition-colors outline-none placeholder:text-foreground/50 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-body-compact file:font-medium file:text-foreground focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/35 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/45',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
