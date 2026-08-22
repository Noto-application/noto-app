import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SidebarTreeItem } from './sidebar-tree-item';
import { FileText } from 'lucide-react';

const meta = {
  title: 'UI/SidebarTreeItem',
  component: SidebarTreeItem,
  parameters: {
    layout: 'centered',
  },
  args: {
    title: 'Документ',
    depth: 0,
    isActive: false,
    hasChildren: false,
    isExpanded: false,
    onClick: () => {},
  },
} satisfies Meta<typeof SidebarTreeItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Active: Story = {
  args: {
    title: 'Активный документ',
    isActive: true,
  },
};

export const Nested: Story = {
  args: {
    title: 'Вложенный документ',
    depth: 1,
  },
};

export const DeepNested: Story = {
  args: {
    title: 'Глубоко вложенный документ',
    depth: 2,
  },
};

export const Expanded: Story = {
  args: {
    title: 'Раздел',
    hasChildren: true,
    isExpanded: true,
  },
};

export const WithChildren: Story = {
  args: {
    title: 'Документы',
    hasChildren: true,
    isExpanded: false,
  },
};

export const WithIcon: Story = {
  args: {
    title: 'Папка',
    icon: <FileText className="size-4" />,
  },
};

export const Collapsed: Story = {
  args: {
    title: 'Раздел',
    hasChildren: true,
    isExpanded: false,
  },
};

export const LongTitle: Story = {
  args: {
    title: 'Очень длинное название страницы, которое должно корректно обрезаться',
  },
};

export const MiniTree: Story = {
  render: () => (
    <div className="w-64">
      <SidebarTreeItem
        title="Главная"
        depth={0}
        isActive
        hasChildren={false}
        isExpanded={false}
        onClick={() => {}}
      />

      <SidebarTreeItem
        title="Документы"
        depth={0}
        isActive={false}
        hasChildren
        isExpanded
        onClick={() => {}}
      />

      <SidebarTreeItem
        title="Проект Noto"
        depth={1}
        isActive={false}
        hasChildren
        isExpanded={false}
        onClick={() => {}}
      />

      <SidebarTreeItem
        title="Задача #62"
        depth={2}
        isActive={false}
        hasChildren={false}
        isExpanded={false}
        onClick={() => {}}
      />

      <SidebarTreeItem
        title="Настройки"
        depth={0}
        isActive={false}
        hasChildren={false}
        isExpanded={false}
        onClick={() => {}}
      />
    </div>
  ),
};
