import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-[288px]">{Story()}</div>],
  args: { placeholder: 'Описание...' },
};

export default meta;

type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue:
      'Лёгкая современная альтернатива Notion для заметок, документации и проектов.',
  },
};

/**
 * Ошибка передаётся через `aria-invalid` — тот же контракт, что у `Input`.
 * Текст подсказки под полем не часть атома, показан здесь только для
 * иллюстрации реального использования.
 */
export const ErrorState: Story = {
  name: 'Error',
  args: { defaultValue: 'неверный', 'aria-invalid': true },
  render: (args) => (
    <div className="flex flex-col gap-1.5">
      <Textarea {...args} />
      <p className="text-label text-destructive">Обязательное поле</p>
    </div>
  ),
};

export const Disabled: Story = {
  args: { defaultValue: 'Заблокировано', disabled: true },
};
