import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { fontVariables } from '@/src/shared/config/fonts';

import './globals.css';

export const metadata: Metadata = {
  title: 'Noto',
  description: 'Лёгкая современная альтернатива Notion.',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
