import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AutosaveIndicator } from './autosave-indicator';

const meta: Meta<typeof AutosaveIndicator> = {
  title: 'Widgets/Editor/AutosaveIndicator',
  component: AutosaveIndicator,
  parameters: { layout: 'centered' },
  args: { onRetry: () => console.log('retry') },
};

export default meta;

type Story = StoryObj<typeof AutosaveIndicator>;

export const Idle: Story = {
  args: { status: 'idle' },
};

export const Saving: Story = {
  args: { status: 'saving' },
};

export const Saved: Story = {
  args: { status: 'saved' },
};

export const Error: Story = {
  args: { status: 'error' },
};
