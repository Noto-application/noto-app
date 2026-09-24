'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { buttonVariants } from '@/src/shared/ui/button';

type PublicNavProps = Readonly<{
  /** Есть auth-cookie — вместо входа/регистрации ведём сразу в приложение. */
  hasSession: boolean;
}>;

export function PublicNav({ hasSession }: PublicNavProps) {
  const pathname = usePathname();

  if (pathname !== '/') {
    return null;
  }

  if (hasSession) {
    return (
      <nav aria-label="Основная навигация" className="flex items-center gap-2">
        <Link className={buttonVariants({ size: 'default' })} href="/app">
          Открыть Noto
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label="Основная навигация" className="flex items-center gap-2">
      <Link className={buttonVariants({ size: 'default', variant: 'outline' })} href="/login">
        Войти
      </Link>
      <Link className={buttonVariants({ size: 'default' })} href="/register">
        Регистрация
      </Link>
    </nav>
  );
}
