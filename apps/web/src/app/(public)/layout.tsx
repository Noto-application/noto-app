import { cookies } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { hasSessionCookie } from '@/src/features/auth';

import { PublicNav } from './public-nav';

type PublicLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function PublicLayout({ children }: PublicLayoutProps) {
  const hasSession = hasSessionCookie(await cookies());

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link className="flex items-center gap-2.5" href="/">
            <span className="flex size-8 items-center justify-center rounded-md bg-foreground text-heading-3 font-semibold text-background">
              N
            </span>
            <span className="text-heading-2">Noto</span>
          </Link>
          <PublicNav hasSession={hasSession} />
        </div>
      </header>
      {children}
    </>
  );
}
