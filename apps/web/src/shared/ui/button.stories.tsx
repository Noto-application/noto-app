import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Plus } from 'lucide-react';

import { Button, type buttonVariants } from './button';

import type { VariantProps } from 'class-variance-authority';

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Создать' },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;
type Variant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;

const variants: Variant[] = ['default', 'secondary', 'ghost', 'destructive'];

/** shadcn-совместимые варианты без прямого аналога в макете — своя таблица,
    чтобы не путать со строками, скопированными из Figma. */
const shadcnOnlyVariants: Variant[] = ['outline', 'link'];

const columns = ['sm', 'md', 'lg', 'disabled', 'loading', 'icon only'];

function MatrixTable({ variants: rows }: { variants: Variant[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="w-[100px]" />
          {columns.map((column) => (
            <th
              key={column}
              className="text-caption px-3 py-1.5 text-left font-semibold tracking-[0.66px] text-muted-foreground uppercase"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((variant) => (
          <tr key={variant} className="border-b border-border">
            <td className="text-body-compact px-3 font-medium text-muted-foreground">{variant}</td>
            <td className="px-3 py-3.5">
              <Button variant={variant} size="sm">
                Создать
              </Button>
            </td>
            <td className="px-3 py-3.5">
              <Button variant={variant}>Создать</Button>
            </td>
            <td className="px-3 py-3.5">
              <Button variant={variant} size="lg">
                Создать
              </Button>
            </td>
            <td className="px-3 py-3.5">
              <Button variant={variant} disabled>
                Создать
              </Button>
            </td>
            <td className="px-3 py-3.5">
              <Button variant={variant} loading>
                Создать
              </Button>
            </td>
            <td className="px-3 py-3.5">
              <Button variant={variant} size="icon" aria-label="Добавить">
                <Plus />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const Playground: Story = {};

/** Матрица из макета: вариант × размер × состояние (Figma, узел 1:1455). */
export const Matrix: Story = {
  name: 'Матрица',
  parameters: { layout: 'padded' },
  render: () => <MatrixTable variants={variants} />,
};

/**
 * outline/link не описаны в макете, поэтому не входят в «Матрицу» — но
 * состояния (disabled/loading) им всё равно нужно проверять, а не только
 * показывать статично.
 */
export const MatrixShadcnOnly: Story = {
  name: 'Матрица — shadcn-only',
  parameters: { layout: 'padded' },
  render: () => <MatrixTable variants={shadcnOnlyVariants} />,
};

export const Variants: Story = {
  name: 'Варианты',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const Sizes: Story = {
  name: 'Размеры',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">sm — 28px</Button>
      <Button size="default">default — 32px</Button>
      <Button size="lg">lg — 38px</Button>
      <Button size="icon-sm" aria-label="Добавить">
        <Plus />
      </Button>
      <Button size="icon" aria-label="Добавить">
        <Plus />
      </Button>
      <Button size="icon-lg" aria-label="Добавить">
        <Plus />
      </Button>
    </div>
  ),
};

export const States: Story = {
  name: 'Состояния',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Обычная</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading</Button>
      <Button variant="secondary" loading>
        Loading
      </Button>
    </div>
  ),
};
