import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Avatar, AvatarFallback, AvatarGroup } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof Avatar>;

/** Цвет заливки — не токен, задаётся по данным пользователя; здесь для примера. */
export const Default: Story = {
  render: () => (
    <Avatar className="bg-[#2563eb]">
      <AvatarFallback>М</AvatarFallback>
    </Avatar>
  ),
};

export const Small: Story = {
  render: () => (
    <Avatar size="sm" className="bg-[#37352f]">
      <AvatarFallback>А</AvatarFallback>
    </Avatar>
  ),
};

export const Large: Story = {
  render: () => (
    <Avatar size="lg" className="bg-[#16a34a]">
      <AvatarFallback>Д</AvatarFallback>
    </Avatar>
  ),
};

export const ExtraLarge: Story = {
  name: 'Extra large',
  render: () => (
    <Avatar size="xl" className="bg-[#d97706]">
      <AvatarFallback>С</AvatarFallback>
    </Avatar>
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
