import Link from 'next/link';

import { AuthLayout } from './auth-layout';

export function ForgotPasswordForm() {
  return (
    <AuthLayout>
      <div className="space-y-2">
        <h1 className="text-page-title">Восстановить пароль</h1>
        <p className="text-body text-muted-foreground">Восстановление пароля недоступно. Нет API</p>
      </div>

      <Link
        className="mt-7 flex h-8 w-full items-center justify-center rounded-md bg-foreground px-3.5 text-body-compact font-medium text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        href="/login"
      >
        Вернуться ко входу
      </Link>
    </AuthLayout>
  );
}
