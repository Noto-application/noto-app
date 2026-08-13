import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { InlineAlert } from './inline-alert';

const meta: Meta<typeof InlineAlert> = {
  title: 'UI/InlineAlert',
  component: InlineAlert,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-[400px]">{Story()}</div>],
};

export default meta;

type Story = StoryObj<typeof InlineAlert>;

export const Info: Story = {
  args: {
    variant: 'info',
    children: 'Страница доступна только участникам рабочего пространства.',
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: 'Черновик не сохранялся больше часа.',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Ошибка сервера. Попробуйте ещё раз.',
  },
};
