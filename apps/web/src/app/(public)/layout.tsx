import Link from 'next/link';
import type { ReactNode } from 'react';

import { PublicNav } from './public-nav';

type PublicLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link className="flex items-center gap-2.5" href="/">
            <span className="flex size-8 items-center justify-center rounded-md bg-foreground text-heading-3 font-semibold text-background">
              N
            </span>
            <span className="text-heading-2">Noto</span>
          </Link>
          <PublicNav />
        </div>
      </header>
      {children}
    </>
  );
}
