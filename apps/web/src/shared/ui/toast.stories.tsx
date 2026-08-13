import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Toaster, toast } from './toast';

const meta: Meta<typeof Toaster> = {
  title: 'UI/Toast',
  component: Toaster,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof Toaster>;

function ToastDemo({ variant }: { variant: 'success' | 'danger' | 'info' }) {
  React.useEffect(() => {
    if (variant === 'success') toast.success('Страница успешно опубликована');
    if (variant === 'danger') toast.error('Не удалось сохранить изменения.', 'Проверьте соединение.');
    if (variant === 'info') toast.info('Сохранено автоматически · только что');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Toaster />;
}

export const Success: Story = {
  render: () => <ToastDemo variant="success" />,
};

export const Danger: Story = {
  render: () => <ToastDemo variant="danger" />,
};

export const Info: Story = {
  render: () => <ToastDemo variant="info" />,
};
