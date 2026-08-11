import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Spinner } from './spinner';

const meta: Meta<typeof Spinner> = {
  title: 'UI/Spinner',
  component: Spinner,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof Spinner>;

/** Три размера из макета: sm (16px) / default (20px) / lg (28px). */
export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Spinner size="sm" />
      <Spinner size="default" />
      <Spinner size="lg" />
    </div>
  ),
};
