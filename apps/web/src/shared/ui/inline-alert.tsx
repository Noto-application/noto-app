import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Строчный alert (Figma «NoTo» → Components → Toast / Alerts → Inline
 * alerts, узел 1:2170). Не было в исходном списке issue #18/#32 — найден
 * по ходу работы над toast, тот же узел покрывает оба компонента.
 *
 * Фон info/danger — та же soft-заливка, что у Toast (`--status-*-bg-soft`).
 * У warning в макете фон совпадает с обычным `--status-warning-bg` —
 * отдельного soft-варианта для него нет.
 */
const inlineAlertVariants = cva('flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-body-compact', {
  variants: {
    variant: {
      info: 'border-status-info-border bg-status-info-bg-soft text-status-info-text',
      warning: 'border-status-warning-border bg-status-warning-bg text-status-warning-text',
      danger: 'border-status-danger-border bg-status-danger-bg-soft text-status-danger-text',
    },
  },
  defaultVariants: { variant: 'info' },
});

const inlineAlertIcons = { info: Info, warning: TriangleAlert, danger: CircleAlert };

interface InlineAlertProps extends React.ComponentProps<'div'>, VariantProps<typeof inlineAlertVariants> {}

function InlineAlert({ className, variant = 'info', children, ...props }: InlineAlertProps) {
  const Icon = inlineAlertIcons[variant ?? 'info'];

  return (
    <div data-slot="inline-alert" className={cn(inlineAlertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

export { InlineAlert, inlineAlertVariants };
