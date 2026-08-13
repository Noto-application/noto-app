import type { ReactNode } from 'react';

type AuthLayoutProps = Readonly<{
  children: ReactNode;
}>;

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-8 sm:px-6">
      <section className="w-full max-w-[400px] rounded-xl border p-6 shadow-sm sm:p-8">
        {children}
      </section>
    </main>
  );
}
