import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Аватар по Design System (Figma «NoTo» → Components → Avatar sizes / Avatar
 * group, узел 1:1771).
 *
 * Цвет заливки — не токен: в макете он персональный (по пользователю),
 * а не часть палитры Foundations. Задаётся снаружи через `className`;
 * без него используется нейтральный `--muted`.
 */
const avatarVariants = cva(
  'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted font-semibold text-white select-none',
  {
    variants: {
      size: {
        sm: 'size-6 text-[9.12px]',
        default: 'size-7 text-[10.64px]',
        lg: 'size-8 text-[12.16px]',
        xl: 'size-9 text-[13.68px]',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

function Avatar({
  className,
  size,
  ...props
}: AvatarPrimitive.Root.Props & VariantProps<typeof avatarVariants>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ size, className }))}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('size-full object-cover', className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn('flex size-full items-center justify-center', className)}
      {...props}
    />
  );
}

/**
 * Группа перекрывающихся аватаров: -8px нахлёст, как в макете. Последний
 * дочерний элемент — обычно `Avatar` со счётчиком `+N` вместо инициалов.
 */
function AvatarGroup({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center [&>*]:-ml-2 [&>*:first-child]:ml-0', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, avatarVariants };
