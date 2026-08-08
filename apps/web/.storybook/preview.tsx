import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview, ReactRenderer } from '@storybook/nextjs-vite';

import { fontVariables } from '../src/shared/config/fonts';

import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    // Фон задают токены (`bg-background`), собственные фоны Storybook
    // только мешали бы проверять тему.
    backgrounds: { disable: true },
  },
  decorators: [
    // Переменные шрифтов в приложении вешает `app/layout.tsx` на <html>.
    // В Storybook его нет, поэтому оборачиваем стори сами.
    (Story) => (
      <div className={`${fontVariables} bg-background text-foreground font-sans`}>
        <Story />
      </div>
    ),
    withThemeByClassName<ReactRenderer>({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
    }),
  ],
};

export default preview;
