import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Типографические токены Design System (см. `--text-*` в globals.css).
 *
 * Без этого списка tailwind-merge считает незнакомый `text-*` цветом текста и,
 * встретив `text-background` вместе с `text-body-compact`, выбрасывает первый —
 * кнопка остаётся с унаследованным тёмным текстом на тёмном фоне.
 */
const fontSizeTokens = [
  'display',
  'page-title',
  'heading-1',
  'heading-2',
  'heading-3',
  'body',
  'body-compact',
  'label',
  'caption',
  'code',
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: fontSizeTokens }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
