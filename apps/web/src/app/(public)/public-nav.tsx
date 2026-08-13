'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { buttonVariants } from '@/src/shared/ui/button';

/** Навигация лендинга не отвлекает на экранах аутентификации. */
export function PublicNav() {
  const pathname = usePathname();

  if (pathname !== '/') {
    return null;
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
