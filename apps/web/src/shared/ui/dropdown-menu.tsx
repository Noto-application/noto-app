import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/src/shared/lib/utils';

/**
 * Выпадающее меню действий (Figma «NoTo» → Components → Dropdown menu,
 * узел 1:1839). В макете есть только триггер — панель, пункты и их состояния
 * не заданы (в проекте нет отдельного дизайнера, см. AGENTS.md). Поверхность
 * и пункты переиспользуют язык, уже принятый в `Select` (`select.tsx`):
 * bg-background/border-border/shadow-md для панели, data-[highlighted] для
 * наведения на пункт — чтобы popover-компоненты не расходились визуально.
 *
 * `DropdownMenuTrigger` намеренно без своих стилей: в макете триггер
 * пиксель-в-пиксель совпадает с `Button` variant="secondary" — вместо
 * дублирования его классов триггер компонуется через `render`:
 * `<DropdownMenuTrigger render={<Button variant="secondary">...</Button>} />`.
 */
const DropdownMenu = MenuPrimitive.Root;

const DropdownMenuTrigger = MenuPrimitive.Trigger;

function DropdownMenuContent({
  className,
  children,
  sideOffset = 4,
  align,
  side,
  ...props
}: MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, 'sideOffset' | 'align' | 'side'>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={sideOffset} align={align} side={side} className="z-50 outline-none">
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'min-w-[180px] origin-[--transform-origin] overflow-y-auto rounded-md border border-border bg-background p-1 text-foreground shadow-md',
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

const dropdownMenuItemVariants = cva(
  "relative flex h-8 cursor-default items-center gap-2 rounded-sm px-2.5 text-body-compact outline-none select-none data-[highlighted]:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: 'text-foreground',
        destructive: 'text-destructive data-[highlighted]:bg-destructive/10',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function DropdownMenuItem({
  className,
  variant = 'default',
  ...props
}: MenuPrimitive.Item.Props & VariantProps<typeof dropdownMenuItemVariants>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(dropdownMenuItemVariants({ variant, className }))}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

/** Обёртка для группы пунктов + `DropdownMenuLabel` — `GroupLabel` из Base UI
 * требует контекст `Group`, без него падает рантайм-ошибкой. */
function DropdownMenuGroup({ className, ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" className={className} {...props} />;
}

function DropdownMenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn('px-2.5 py-1.5 text-label text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
