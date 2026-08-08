import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Search } from 'lucide-react';

import { Input } from './input';

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { placeholder: 'Название страницы' },
};

/** Матрица из макета: Default / Filled / Error / Disabled / Search. */
export const States: Story = {
  name: 'Состояния',
  render: () => (
    <div className="grid w-[288px] gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-label tracking-[0.77px] text-muted-foreground uppercase">
          Default
        </span>
        <Input placeholder="Название страницы" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label tracking-[0.77px] text-muted-foreground uppercase">Filled</span>
        <Input defaultValue="Архитектура системы" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label tracking-[0.77px] text-muted-foreground uppercase">Error</span>
        <Input defaultValue="неверный" aria-invalid />
        <p className="text-label text-destructive">Обязательное поле</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label tracking-[0.77px] text-muted-foreground uppercase">
          Disabled
        </span>
        <Input defaultValue="Заблокировано" disabled />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label tracking-[0.77px] text-muted-foreground uppercase">Search</span>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск..." className="pl-8.5" />
        </div>
      </div>
    </div>
  ),
};
