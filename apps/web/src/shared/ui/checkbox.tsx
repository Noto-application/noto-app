import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check } from 'lucide-react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Чекбокс по Design System (Figma «NoTo» → Components → Checkbox,
 * узел 1:1716).
 *
 * Рамка — `--control-border`, отдельный от `--border` токен (см. globals.css):
 * в Foundations такого цвета нет, он взят из самого макета чекбокса.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'size-[15px] shrink-0 rounded-[2px] border border-control-border bg-background outline-none transition-colors hover:border-2 hover:border-foreground hover:ring-4 hover:ring-surface-selected focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary data-[checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-primary-foreground"
      >
        <Check className="size-[13px]" strokeWidth={2.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
