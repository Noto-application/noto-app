import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Модальный диалог — своего дизайна в Figma нет (узел 1:1847 содержит
 * только триггер), спроектирован самостоятельно. Обоснование и открытые
 * вопросы → `dialog.notes.md` рядом с этим файлом.
 */
const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

/**
 * Без стилей, как `DialogTrigger` — композируется через `render`
 * (`<DialogClose render={<Button variant="secondary">Отмена</Button>} />`).
 * Не путать с крестиком внутри `DialogContent` — тот всегда есть в самой
 * панели, `DialogClose` — для дополнительных кнопок закрытия в футере
 * (например, «Отмена»).
 */
const DialogClose = DialogPrimitive.Close;

/**
 * Общие с `AlertDialogContent` классы — держать в одном месте, чтобы
 * визуальный язык обоих не разъезжался.
 *
 * data-starting-style/data-ending-style — состояния входа/выхода, которые
 * сам Base UI навешивает на Popup/Backdrop вокруг CSS-transition (держит
 * элемент в DOM, пока анимация не закончится). В макете анимация не
 * задана — типичный fade (+ лёгкий scale у панели), придумано нами.
 */
const dialogBackdropClassName =
  'fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 ease-out motion-reduce:transition-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0';
// bg-surface, не bg-background: в тёмной теме страница и модалка на
// bg-background почти сливаются (контраст ~1.1:1) — backdrop дополнительно
// затемняет уже тёмный фон, а не даёт панели выделиться. surface на ступень
// светлее и в тёмной теме, и почти не отличается в светлой.
const dialogPopupClassName =
  'fixed top-1/2 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-lg outline-none transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0';

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop data-slot="dialog-backdrop" className={dialogBackdropClassName} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(dialogPopupClassName, className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="absolute top-4 right-4 rounded-sm p-1 text-muted-foreground outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/35 [&_svg]:size-4"
        >
          <X />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="dialog-header" className={cn('flex flex-col gap-1.5', className)} {...props} />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="dialog-footer" className={cn('flex justify-end gap-2', className)} {...props} />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-heading-3 text-foreground', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-body text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  dialogBackdropClassName,
  dialogPopupClassName,
};
