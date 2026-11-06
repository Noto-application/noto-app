import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button } from '@/src/shared/ui/button';

import { TrashPageRow } from './trash-page-row';

const samplePage = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  parentId: null,
  title: 'План проекта',
  position: 0,
  deletedAt: '2026-11-01T10:00:00.000Z',
};

const meta: Meta<typeof TrashPageRow> = {
  title: 'Widgets/PageTrash/Row',
  component: TrashPageRow,
  decorators: [
    (Story) => (
      <ul className="m-4 max-w-3xl divide-y divide-border rounded-lg border border-border">
        <Story />
      </ul>
    ),
  ],
  args: {
    page: samplePage,
    action: <Button variant="secondary">Восстановить</Button>,
  },
};
export default meta;
type Story = StoryObj<typeof TrashPageRow>;
export const Default: Story = {};
export const Restoring: Story = {
  args: {
    action: (
      <Button variant="secondary" loading>
        Восстановление…
      </Button>
    ),
  },
};
export const Conflict: Story = {
  args: {
    action: (
      <div className="space-y-2">
        <Button variant="secondary">Восстановить</Button>
        <p role="alert" className="max-w-sm text-body-compact text-destructive">
          Сначала восстановите родительскую страницу «Документация».
        </p>
      </div>
    ),
  },
};
export const LongTitle: Story = {
  args: {
    page: {
      ...samplePage,
      title:
        'Очень длинное название удалённой страницы с подробным описанием заметок и планов по разработке проекта',
    },
  },
};
