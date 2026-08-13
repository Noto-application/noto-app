import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Plus } from 'lucide-react';

import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Создать' },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
};

/** shadcn-совместимый вариант без прямого аналога в макете. */
export const Outline: Story = {
  args: { variant: 'outline' },
};

/** shadcn-совместимый вариант без прямого аналога в макете. */
export const Link: Story = {
  args: { variant: 'link' },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Loading: Story = {
  args: { loading: true },
};

export const IconOnly: Story = {
  name: 'Icon only',
  args: { size: 'icon', 'aria-label': 'Добавить', children: undefined },
  render: (args) => (
    <Button {...args}>
      <Plus />
    </Button>
  ),
};
