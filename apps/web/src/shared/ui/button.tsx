import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader } from 'lucide-react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Кнопка по Design System (Figma «NoTo» → Components → Кнопки, узел 1:1455).
 *
 * Имена вариантов и размеров — shadcn-совместимые (критерий приёмки FE-2),
 * поэтому `primary` из макета здесь называется `default`, а `md` — `default`.
 *
 * `default` красится в `--foreground`, а не в `--primary`: в этой системе
 * основная кнопка тёмная, а синий `--primary` работает как акцент ссылок
 * и кольца фокуса.
 */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-foreground text-background hover:bg-foreground-hover focus-visible:border-foreground focus-visible:ring-foreground/35',
        secondary:
          'border-border bg-surface text-foreground hover:bg-surface-hover focus-visible:border-foreground focus-visible:ring-foreground/35',
        outline:
          'border-border bg-background text-foreground hover:bg-surface-hover focus-visible:border-foreground focus-visible:ring-foreground/35',
        ghost:
          'text-foreground hover:bg-surface-hover focus-visible:border-foreground focus-visible:ring-foreground/35',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive-hover focus-visible:border-destructive focus-visible:ring-destructive/50',
        link: 'text-primary underline-offset-4 hover:text-primary-hover hover:underline focus-visible:border-ring focus-visible:ring-ring/50',
      },
      size: {
        sm: "h-7 px-2.5 text-label [&_svg:not([class*='size-'])]:size-3",
        default: "h-8 px-3.5 text-body-compact [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9.5 px-5 text-body [&_svg:not([class*='size-'])]:size-4",
        icon: "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': "size-7 [&_svg:not([class*='size-'])]:size-3",
        'icon-lg': "size-9.5 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Показывает спиннер и блокирует кнопку. */
    loading?: boolean;
  };

function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      // не ??: disabled может быть явным false, а loading всё равно должен блокировать
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? <Loader className="spinner animate-spinner" aria-hidden="true" /> : null}
      {children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
