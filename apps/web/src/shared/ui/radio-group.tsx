import { Radio } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';

import { cn } from '@/src/shared/lib/utils';

/**
 * Радио-группа по Design System (Figma «NoTo» → Components → Radio,
 * узел 1:1735).
 *
 * Имена `RadioGroup`/`RadioGroupItem` — shadcn-совместимые (критерий приёмки
 * FE-2); в `@base-ui/react` это раздельные пакеты `radio-group` (состояние
 * группы) и `radio` (сам переключатель, `Radio.Root`/`Radio.Indicator`).
 */
function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

/**
 * Рамка — тот же `--control-border`, что и у `Checkbox` (#767676 в макете).
 * В отличие от `Checkbox`, отмеченное состояние не заливает фон целиком:
 * белый фон сохраняется, внутри появляется закрашенная точка (`--primary`).
 */
function RadioGroupItem({ className, ...props }: Radio.Root.Props) {
  return (
    <Radio.Root
      data-slot="radio-group-item"
      className={cn(
        'flex size-[15px] shrink-0 items-center justify-center rounded-full border border-control-border bg-background outline-none transition-colors hover:border-2 hover:border-foreground hover:ring-4 hover:ring-surface-selected focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary',
        className,
      )}
      {...props}
    >
      <Radio.Indicator data-slot="radio-group-indicator" className="size-[9px] rounded-full bg-primary" />
    </Radio.Root>
  );
}

export { RadioGroup, RadioGroupItem };
