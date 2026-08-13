import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof Skeleton>;

/** Как в макете: заголовок, три строки текста, два чипа-действия. */
export const Default: Story = {
  render: () => (
    <div className="flex w-[300px] flex-col gap-2">
      <Skeleton className="h-6 w-[200px]" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-[85%]" />
      <Skeleton className="h-3.5 w-[70%]" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
  ),
};
