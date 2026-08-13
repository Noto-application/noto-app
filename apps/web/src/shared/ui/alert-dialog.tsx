import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';

import { cn } from '@/src/shared/lib/utils';
import { Button, type buttonVariants } from './button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle, dialogBackdropClassName, dialogPopupClassName } from './dialog';
import type { VariantProps } from 'class-variance-authority';

/**
 * Подтверждающий диалог — тот же визуальный язык, что у `Dialog`
 * (`dialog.tsx`), но без крестика-закрытия: alert-dialog не закрывается
 * кликом снаружи или крестиком, только явным выбором Action/Cancel — так
 * задаёт `AlertDialogRoot` из `@base-ui/react` (модальность и защита от
 * случайного закрытия встроены в примитив, не настраиваются). Обоснование →
 * `dialog.notes.md`.
 */
const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

function AlertDialogContent({ className, children, ...props }: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop data-slot="alert-dialog-backdrop" className={dialogBackdropClassName} />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(dialogPopupClassName, className)}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Popup>
    </AlertDialogPrimitive.Portal>
  );
}

const AlertDialogHeader = DialogHeader;
const AlertDialogFooter = DialogFooter;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;

type AlertDialogActionProps = AlertDialogPrimitive.Close.Props & VariantProps<typeof buttonVariants>;

function AlertDialogAction({ className, variant = 'default', ...props }: AlertDialogActionProps) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      render={<Button variant={variant} className={className} />}
      {...props}
    />
  );
}

function AlertDialogCancel({ className, ...props }: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      render={<Button variant="secondary" className={className} />}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
