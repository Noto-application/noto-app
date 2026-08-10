import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button } from './button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

const meta: Meta<typeof Dialog> = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof Dialog>;

/** Панель открыта по умолчанию для ревью. */
export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger render={<Button variant="secondary">Открыть диалог</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Переименовать страницу</DialogTitle>
          <DialogDescription>Новое имя будет видно в сайдбаре и во всех ссылках.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary">Отмена</Button>} />
          <Button>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
