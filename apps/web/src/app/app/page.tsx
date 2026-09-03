'use client';

import { CreatePageButton } from '@/src/features/create-page';

export default function AppPage() {
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <section className="flex max-w-md flex-col items-center text-center">
        <h1 className="text-heading-1 text-foreground">Начните с первой страницы</h1>
        <p className="mt-3 text-body text-muted-foreground">
          Создайте заметку, документ или план — название можно будет изменить позже.
        </p>
        <CreatePageButton className="mt-6" size="lg">
          Создать страницу
        </CreatePageButton>
      </section>
    </main>
  );
}
