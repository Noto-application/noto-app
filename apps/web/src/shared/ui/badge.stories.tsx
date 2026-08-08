import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Badge } from './badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { children: 'Готово', variant: 'success' },
};

/** Пять вариантов из макета: Черновик / В работе / Готово / Ошибка / На ревью. */
export const Variants: Story = {
  name: 'Варианты',
  render: () => (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="neutral">Черновик</Badge>
      <Badge variant="info">В работе</Badge>
      <Badge variant="success">Готово</Badge>
      <Badge variant="danger">Ошибка</Badge>
      <Badge variant="warning">На ревью</Badge>
    </div>
  ),
};
