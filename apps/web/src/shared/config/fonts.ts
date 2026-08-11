import { Cousine, Inter } from 'next/font/google';

/**
 * Гарнитуры Design System: Inter — основная, Cousine — моноширинная (стиль Code).
 *
 * Живут здесь, а не в `app/layout.tsx`, потому что те же переменные нужны
 * Storybook: иначе типографика в сторях отрисуется системным шрифтом
 * и разъедется с макетом.
 */
export const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

// preload: false — Cousine нужен только для моноширинного текста (стиль Code).
// С преднагрузкой браузер тянет его на каждой странице и ругается, что файл
// скачан и не использован. Загрузится по факту появления `font-mono`.
export const cousine = Cousine({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-cousine',
  display: 'swap',
  preload: false,
});

export const fontVariables = `${inter.variable} ${cousine.variable}`;
