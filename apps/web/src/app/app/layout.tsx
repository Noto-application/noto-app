import type { ReactNode } from 'react';

import { QueryProvider } from '@/src/shared/api';

type AppLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AppLayout({ children }: AppLayoutProps) {
  return <QueryProvider>{children}</QueryProvider>;
}
