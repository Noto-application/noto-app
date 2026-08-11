import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Checkbox } from './checkbox';

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Состояния из макета: отмечено / не отмечено, плюс disabled. */
export const States: Story = {
  name: 'Состояния',
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-body text-foreground">
        <Checkbox defaultChecked />
        Отмечено
      </label>
      <label className="flex items-center gap-2 text-body text-foreground">
        <Checkbox />
        Не отмечено
      </label>
      <label className="flex items-center gap-2 text-body text-foreground opacity-60">
        <Checkbox disabled />
        Disabled
      </label>
      <label className="flex items-center gap-2 text-body text-foreground opacity-60">
        <Checkbox disabled defaultChecked />
        Disabled + checked
      </label>
    </div>
  ),
};
