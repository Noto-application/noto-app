import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Toast-уведомления (Figma «NoTo» → Components → Toast / Alerts, узел
 * 1:2137). В отличие от dropdown-menu/dialog здесь полноценный дизайн —
 * три статус-варианта.
 *
 * Фон у success/danger/info светлее, чем `--status-*-bg` у Badge (только
 * `warning` совпадает) — рамка и цвет иконки при этом идентичны badge.
 * Разошедшиеся фоны заведены отдельными `--status-*-bg-soft` токенами
 * (см. globals.css), а не подогнаны под badge — расхождение из самого
 * макета, не наша правка. Обоснование → `toast.notes.md` рядом.
 */
const toastManager = ToastPrimitive.createToastManager();

type ToastVariant = 'success' | 'danger' | 'info';

const toast = {
  success: (title: string, description?: string) => toastManager.add({ type: 'success', title, description }),
  error: (title: string, description?: string) => toastManager.add({ type: 'danger', title, description }),
  info: (title: string, description?: string) => toastManager.add({ type: 'info', title, description }),
};

const toastVariants = cva(
  'flex w-full max-w-[340px] items-center gap-2.5 rounded-lg border px-3.5 py-2.5 shadow-sm',
  {
    variants: {
      type: {
        success: 'border-status-success-border bg-status-success-bg-soft',
        danger: 'border-status-danger-border bg-status-danger-bg-soft',
        info: 'border-status-info-border bg-status-info-bg-soft',
      },
    },
  },
);

const toastIconVariants = cva(
  'flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] leading-none font-bold text-white',
  {
    variants: {
      type: {
        success: 'bg-status-success-text',
        danger: 'bg-status-danger-text',
        info: 'bg-status-info-text',
      },
    },
  },
);

const toastGlyphs = { success: '✓', danger: '!', info: 'i' };

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();

  return toasts.map((t) => {
    const type = (t.type ?? 'info') as ToastVariant;

    return (
      <ToastPrimitive.Root key={t.id} toast={t} data-slot="toast" className={cn(toastVariants({ type }))}>
        <span className={cn(toastIconVariants({ type }))} aria-hidden="true">
          {toastGlyphs[type]}
        </span>
        <ToastPrimitive.Title className="flex-1 text-body-compact text-foreground" />
        <ToastPrimitive.Close
          aria-label="Закрыть"
          className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-3.5"
        >
          <X />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    );
  });
}

/** Монтируется один раз на верхнем уровне приложения (`app/layout.tsx`). */
function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={toastManager}>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport
          data-slot="toast-viewport"
          className="fixed right-4 bottom-4 z-50 flex flex-col gap-2"
        >
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}

export { Toaster, toast };
