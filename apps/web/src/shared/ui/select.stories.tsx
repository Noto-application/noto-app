import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-[180px]">{Story()}</div>],
};

export default meta;

type Story = StoryObj<typeof Select>;

const languages = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
];

/** Как в макете: язык интерфейса, выбрано «Русский». */
export const Default: Story = {
  render: () => (
    <Select defaultValue="ru" items={languages}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((language) => (
          <SelectItem key={language.value} value={language.value}>
            {language.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select defaultValue="ru" items={languages} disabled>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((language) => (
          <SelectItem key={language.value} value={language.value}>
            {language.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};
