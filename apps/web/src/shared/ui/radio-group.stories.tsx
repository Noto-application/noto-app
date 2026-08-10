import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RadioGroup, RadioGroupItem } from './radio-group';

const meta = {
  title: 'UI/RadioGroup',
  component: RadioGroup,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Обычное использование: группа из нескольких вариантов, один выбран. */
export const Default: Story = {
  args: { defaultValue: 'a' },
  render: (args) => (
    <RadioGroup {...args}>
      <label className="flex items-center gap-2 text-body text-foreground">
        <RadioGroupItem value="a" />
        Вариант A
      </label>
      <label className="flex items-center gap-2 text-body text-foreground">
        <RadioGroupItem value="b" />
        Вариант B
      </label>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup>
      <label className="flex items-center gap-2 text-body text-foreground opacity-60">
        <RadioGroupItem value="a" disabled />
        Disabled
      </label>
    </RadioGroup>
  ),
};

export const DisabledChecked: Story = {
  name: 'Disabled + выбрано',
  render: () => (
    <RadioGroup defaultValue="a">
      <label className="flex items-center gap-2 text-body text-foreground opacity-60">
        <RadioGroupItem value="a" disabled />
        Disabled + выбрано
      </label>
    </RadioGroup>
  ),
};
