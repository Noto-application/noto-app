import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ChevronDown } from 'lucide-react';

import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

const meta: Meta<typeof DropdownMenu> = {
  title: 'UI/DropdownMenu',
  component: DropdownMenu,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof DropdownMenu>;

/** Как в макете: триггер — Button variant="secondary". Панель открыта для ревью. */
export const Default: Story = {
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        render={
          <Button variant="secondary">
            Действия
            <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Страница</DropdownMenuLabel>
          <DropdownMenuItem>Переименовать</DropdownMenuItem>
          <DropdownMenuItem>Дублировать</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Удалить</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const Disabled: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="secondary" disabled>
            Действия
            <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent>
        <DropdownMenuItem>Переименовать</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
