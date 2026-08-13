import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Выпадающий список по Design System (Figma «NoTo» → Components → Select,
 * узел 1:1753).
 *
 * Составной компонент из примитивов Base UI, как и остальные части UI-kit.
 * Публичное API — `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`.
 */
const Select = SelectPrimitive.Root;

/** Ширина — `w-full`, задаётся контейнером снаружи (ADR-014: хардкод размеров запрещён). */
function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-[35px] w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-4 text-body text-foreground outline-none transition-colors hover:bg-surface-hover focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/35 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-2.5",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon data-slot="select-icon" className="text-foreground">
        <ChevronDown />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: SelectPrimitive.Popup.Props & Pick<SelectPrimitive.Positioner.Props, 'sideOffset'>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={sideOffset} className="z-50 outline-none">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'max-h-[--available-height] min-w-[180px] origin-[--transform-origin] overflow-y-auto rounded-md border border-border bg-background p-1 text-foreground shadow-md',
            className,
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex h-8 cursor-default items-center gap-2 rounded-sm px-2.5 text-body-compact text-foreground outline-none select-none data-[highlighted]:bg-surface-hover [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator data-slot="select-item-indicator" className="text-primary">
        <Check />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText data-slot="select-item-text">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
