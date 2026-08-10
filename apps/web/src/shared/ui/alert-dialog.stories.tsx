import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

const meta: Meta<typeof AlertDialog> = {
  title: 'UI/AlertDialog',
  component: AlertDialog,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof AlertDialog>;

/** Панель открыта по умолчанию для ревью. Крестика и закрытия кликом снаружи нет намеренно. */
export const Default: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger render={<Button variant="secondary">Удалить страницу</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить страницу?</AlertDialogTitle>
          <AlertDialogDescription>
            Страница переместится в корзину. Это действие можно отменить в течение 30 дней.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Удалить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
