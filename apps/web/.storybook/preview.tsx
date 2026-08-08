import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview, ReactRenderer } from '@storybook/nextjs-vite';
import { useEffect } from 'react';

import { fontVariables } from '../src/shared/config/fonts';

import '../src/app/globals.css';

const fontVariableClasses = fontVariables.split(' ').filter(Boolean);

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    // Фон задают токены (`bg-background`), собственные фоны Storybook
    // только мешали бы проверять тему.
    backgrounds: { disable: true },
  },
  decorators: [
    // Base UI рендерит попапы (Select, Dialog, Toast...) через Portal прямо
    // в <body>, минуя обёртку ниже — на них она не действует. Storybook
    // задаёт body свой font-family вне @layer, а любой неслоистый CSS
    // в Tailwind v4 побеждает @layer base независимо от специфичности —
    // поэтому портированный контент получает шрифт Storybook, а не Inter.
    // Инлайновый стиль на <html> перебивает и то, и другое.
    (Story) => {
      useEffect(() => {
        const html = document.documentElement;
        html.classList.add(...fontVariableClasses);
        html.style.fontFamily = 'var(--font-sans)';
        return () => {
          html.classList.remove(...fontVariableClasses);
          html.style.removeProperty('font-family');
        };
      }, []);
      return (
        <div className={`${fontVariables} bg-background text-foreground font-sans`}>
          <Story />
        </div>
      );
    },
    withThemeByClassName<ReactRenderer>({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
    }),
  ],
};

export default preview;
