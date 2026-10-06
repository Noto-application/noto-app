'use client';

import { useEffect } from 'react';

import { Button } from '@/src/shared/ui/button';

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-heading-1 text-foreground">Что-то пошло не так.</h1>
      <Button onClick={reset}>Попробовать снова</Button>
    </div>
  );
}
