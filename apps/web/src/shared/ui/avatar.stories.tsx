import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Avatar, AvatarFallback, AvatarGroup } from './avatar';

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Avatar className="bg-[#2563eb]">
      <AvatarFallback>М</AvatarFallback>
    </Avatar>
  ),
};

/** Шкала размеров из макета: 24 / 28 / 32 / 36px. Цвет заливки — не токен,
    задаётся по данным пользователя; здесь для примера. */
export const Sizes: Story = {
  name: 'Размеры',
  render: () => (
    <div className="flex items-end gap-2">
      <Avatar size="sm" className="bg-[#37352f]">
        <AvatarFallback>А</AvatarFallback>
      </Avatar>
      <Avatar size="default" className="bg-[#2563eb]">
        <AvatarFallback>М</AvatarFallback>
      </Avatar>
      <Avatar size="lg" className="bg-[#16a34a]">
        <AvatarFallback>Д</AvatarFallback>
      </Avatar>
      <Avatar size="xl" className="bg-[#d97706]">
        <AvatarFallback>С</AvatarFallback>
      </Avatar>
    </div>
  ),
};

/** Перекрытие -8px, последний элемент — счётчик «+N». */
export const Group: Story = {
  name: 'Avatar group',
  render: () => (
    <AvatarGroup>
      <Avatar className="bg-[#37352f]">
        <AvatarFallback>АИ</AvatarFallback>
      </Avatar>
      <Avatar className="bg-[#2563eb]">
        <AvatarFallback>МК</AvatarFallback>
      </Avatar>
      <Avatar className="bg-[#16a34a]">
        <AvatarFallback>ДЛ</AvatarFallback>
      </Avatar>
      <Avatar className="bg-[#d97706]">
        <AvatarFallback>СБ</AvatarFallback>
      </Avatar>
      <Avatar className="bg-muted text-muted-foreground">
        <AvatarFallback>+3</AvatarFallback>
      </Avatar>
    </AvatarGroup>
  ),
};
