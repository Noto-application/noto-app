import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FileText } from 'lucide-react';

import { Button } from './button';
import { EmptyState } from './empty-state';

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-[500px]">{Story()}</div>],
  // icon/action — React-элементы, контролу взяться неоткуда. title/description
  // почти всегда просто строки — даём им текстовый контрол явно.
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

/**
 * Как в макете: «Нет страниц» + действие создания. `icon`/`action` заданы
 * прямо в `render` (JSX, не редактируется через Controls), `title`/
 * `description` идут через `args` — их можно менять вживую.
 */
export const Default: Story = {
  args: {
    title: 'Нет страниц',
    description: 'Создайте первую страницу в этом проекте',
  },
  render: (args) => (
    <EmptyState
      {...args}
      icon={<FileText />}
      action={
        <Button size="sm" variant="secondary">
          Создать страницу
        </Button>
      }
    />
  ),
};

export const WithoutAction: Story = {
  name: 'Без действия',
  args: {
    title: 'Нет страниц',
    description: 'Создайте первую страницу в этом проекте',
  },
  render: (args) => <EmptyState {...args} icon={<FileText />} />,
};
