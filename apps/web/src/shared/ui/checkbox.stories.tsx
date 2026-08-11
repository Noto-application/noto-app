import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Checkbox } from './checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'UI/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: (args) => (
    <label className="flex items-center gap-2 text-body text-foreground">
      <Checkbox {...args} />
      Не отмечено
    </label>
  ),
};

export const Checked: Story = {
  args: { defaultChecked: true },
  render: (args) => (
    <label className="flex items-center gap-2 text-body text-foreground">
      <Checkbox {...args} />
      Отмечено
    </label>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <label className="flex items-center gap-2 text-body text-foreground opacity-60">
      <Checkbox {...args} />
      Disabled
    </label>
  ),
};

export const DisabledChecked: Story = {
  name: 'Disabled + выбрано',
  args: { disabled: true, defaultChecked: true },
  render: (args) => (
    <label className="flex items-center gap-2 text-body text-foreground opacity-60">
      <Checkbox {...args} />
      Disabled + выбрано
    </label>
  ),
};
