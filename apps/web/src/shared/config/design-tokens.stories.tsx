import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactNode } from 'react';

/**
 * Витрина Foundations из Figma «NoTo» (узел 1:986).
 *
 * Всё ниже нарисовано только утилитами токенов — hex встречается лишь как
 * подпись. Если стори выглядит правильно, значит токены действительно
 * доехали до Tailwind.
 */

const colorTokens = [
  { name: '--background', hex: '#ffffff', className: 'bg-background' },
  { name: '--foreground', hex: '#1a1a18', className: 'bg-foreground' },
  { name: '--surface', hex: '#f9f9f7', className: 'bg-surface' },
  { name: '--surface-hover', hex: '#f1f1ef', className: 'bg-surface-hover' },
  { name: '--surface-selected', hex: '#e9e9e7', className: 'bg-surface-selected' },
  { name: '--muted', hex: '#f4f4f2', className: 'bg-muted' },
  { name: '--muted-foreground', hex: '#8b8b88', className: 'bg-muted-foreground' },
  { name: '--border', hex: '#e8e8e5', className: 'bg-border' },
  { name: '--border-strong', hex: '#cfcfcc', className: 'bg-border-strong' },
  { name: '--primary', hex: '#2563eb', className: 'bg-primary' },
  { name: '--primary-hover', hex: '#1d4ed8', className: 'bg-primary-hover' },
  { name: '--primary-foreground', hex: '#ffffff', className: 'bg-primary-foreground' },
  { name: '--destructive', hex: '#dc2626', className: 'bg-destructive' },
  { name: '--warning', hex: '#d97706', className: 'bg-warning' },
  { name: '--success', hex: '#16a34a', className: 'bg-success' },
];

const typeScale = [
  {
    name: 'Display',
    spec: '36px / 700',
    className: 'text-display',
    sample: 'Документация проекта',
  },
  {
    name: 'Page Title',
    spec: '28px / 700',
    className: 'text-page-title',
    sample: 'Технический дизайн',
  },
  {
    name: 'Heading 1',
    spec: '22px / 600',
    className: 'text-heading-1',
    sample: 'Архитектура системы',
  },
  { name: 'Heading 2', spec: '18px / 600', className: 'text-heading-2', sample: 'API Reference' },
  {
    name: 'Heading 3',
    spec: '15px / 600',
    className: 'text-heading-3',
    sample: 'Параметры запроса',
  },
  {
    name: 'Body',
    spec: '14px / 400',
    className: 'text-body',
    sample: 'Основной текст для длительного чтения. Редактор документов должен быть комфортным.',
  },
  {
    name: 'Body Compact',
    spec: '13px / 400',
    className: 'text-body-compact',
    sample: 'Компактный текст для интерфейсных элементов',
  },
  { name: 'Label', spec: '12px / 500', className: 'text-label', sample: 'Подпись к полю ввода' },
  {
    name: 'Caption',
    spec: '11px / 400',
    className: 'text-caption',
    sample: '12 авг 2025 · 4 мин чтения',
  },
];

const spacingScale = [
  { label: '2', className: 'size-0.5' },
  { label: '4', className: 'size-1' },
  { label: '6', className: 'size-1.5' },
  { label: '8', className: 'size-2' },
  { label: '12', className: 'size-3' },
  { label: '16', className: 'size-4' },
  { label: '20', className: 'size-5' },
  { label: '24', className: 'size-6' },
  { label: '32', className: 'size-8' },
  { label: '40', className: 'size-10' },
  { label: '48', className: 'size-12' },
  { label: '64', className: 'size-16' },
];

const radiusScale = [
  { label: 'sm', value: '4px', className: 'rounded-sm' },
  { label: 'md', value: '6px', className: 'rounded-md' },
  { label: 'lg', value: '8px', className: 'rounded-lg' },
  { label: 'xl', value: '12px', className: 'rounded-xl' },
  { label: 'full', value: '999px', className: 'rounded-full' },
];

const shadowScale = [
  { label: 'shadow-sm', className: 'shadow-sm' },
  { label: 'shadow-md', className: 'shadow-md' },
  { label: 'shadow-lg', className: 'shadow-lg' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pb-14">
      <div className="border-b border-border pb-3">
        <h2 className="text-heading-2">{title}</h2>
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return <p className="text-label tracking-[0.84px] text-muted-foreground uppercase">{children}</p>;
}

const meta = {
  title: 'Foundations/Tokens',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  name: 'Цвета',
  render: () => (
    <div className="mx-auto max-w-[960px] px-8 py-12">
      <Section title="Цвета">
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {colorTokens.map((token) => (
            <div key={token.name} className="flex items-center gap-3 border-b border-border py-2">
              <div
                className={`size-8 shrink-0 rounded-sm border border-border ${token.className}`}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-code font-mono">{token.name}</span>
                <span className="text-caption text-muted-foreground">{token.hex}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-caption pt-4 text-muted-foreground">
          Подписи с hex — значения светлой темы. Переключатель темы в тулбаре Storybook.
        </p>
      </Section>
    </div>
  ),
};

export const Typography: Story = {
  name: 'Типографика',
  render: () => (
    <div className="mx-auto max-w-[960px] px-8 py-12">
      <Section title="Типографика">
        <div>
          {typeScale.map((style) => (
            <div key={style.name} className="flex items-baseline gap-6 border-b border-border py-3">
              <div className="w-[130px] shrink-0">
                <p className="text-label text-muted-foreground">{style.name}</p>
                <p className="text-caption text-muted-foreground">{style.spec}</p>
              </div>
              <p className={style.className}>{style.sample}</p>
            </div>
          ))}

          <div className="flex items-baseline gap-6 border-b border-border py-3">
            <div className="w-[130px] shrink-0">
              <p className="text-label text-muted-foreground">Code</p>
              <p className="text-caption text-muted-foreground">13px / 400</p>
            </div>
            <p className="text-code font-mono">const page = await api.getPage(id)</p>
          </div>

          <div className="flex items-baseline gap-6 border-b border-border py-3">
            <div className="w-[130px] shrink-0">
              <p className="text-label text-muted-foreground">Link</p>
              <p className="text-caption text-muted-foreground">14px / 400</p>
            </div>
            <a href="#" className="text-body text-primary underline underline-offset-2">
              Перейти к документации
            </a>
          </div>
        </div>
      </Section>
    </div>
  ),
};

export const SpacingAndRadius: Story = {
  name: 'Spacing & Radius',
  render: () => (
    <div className="mx-auto max-w-[960px] px-8 py-12">
      <Section title="Spacing & Radius">
        <SubTitle>Spacing scale</SubTitle>
        <div className="flex items-end gap-2 pt-4">
          {spacingScale.map((step) => (
            <div key={step.label} className="flex flex-col items-center gap-1">
              <div className={`rounded-sm bg-primary ${step.className}`} />
              <span className="text-caption text-muted-foreground">{step.label}</span>
            </div>
          ))}
        </div>
        <p className="text-caption pt-3 text-muted-foreground">
          Совпадает с дефолтной шкалой Tailwind, отдельных токенов не заводили.
        </p>

        <div className="pt-8">
          <SubTitle>Border radius</SubTitle>
          <div className="flex items-end gap-4 pt-4">
            {radiusScale.map((radius) => (
              <div key={radius.label} className="flex flex-col items-center gap-1.5">
                <div className={`size-12 border border-border bg-surface ${radius.className}`} />
                <span className="text-caption text-muted-foreground">{radius.value}</span>
                <span className="text-caption text-muted-foreground">{radius.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-8">
          <SubTitle>Shadows</SubTitle>
          <div className="flex items-center gap-6 pt-4">
            {shadowScale.map((shadow) => (
              <div key={shadow.label} className="flex flex-col items-center gap-2">
                <div className={`h-12 w-[72px] rounded-md bg-background ${shadow.className}`} />
                <span className="text-caption text-muted-foreground">{shadow.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  ),
};
