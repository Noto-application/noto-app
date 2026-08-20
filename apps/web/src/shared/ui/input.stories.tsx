import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Search as SearchIcon } from 'lucide-react';

import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-[288px]">{Story()}</div>],
  args: { placeholder: 'Название страницы' },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const Filled: Story = {
  args: { defaultValue: 'Архитектура системы' },
};

export const ErrorState: Story = {
  name: 'Error',
  args: { defaultValue: 'неверный', 'aria-invalid': true },
  render: (args) => (
    <div className="flex flex-col gap-1.5">
      <Input {...args} />
      <p className="text-label text-destructive">Обязательное поле</p>
    </div>
  ),
};

export const Disabled: Story = {
  args: { defaultValue: 'Заблокировано', disabled: true },
};

/** Пример использования с иконкой-префиксом — не отдельный вариант компонента. */
export const Search: Story = {
  args: { placeholder: 'Поиск...', className: 'pl-8.5' },
  render: (args) => (
    <div className="relative">
      <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input {...args} />
    </div>
  ),
};
