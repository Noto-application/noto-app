import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
  args: { children: 'Черновик' },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Info: Story = {
  args: { variant: 'info', children: 'В работе' },
};

export const Success: Story = {
  args: { variant: 'success', children: 'Готово' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Ошибка' },
};

export const Warning: Story = {
  args: { variant: 'warning', children: 'На ревью' },
};
