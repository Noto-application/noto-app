'use client';

import type { ApiErrorCode } from '@noto/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { usePage } from '@/src/entities/page';
import { ApiClientError } from '@/src/shared/api';
import { Spinner } from '@/src/shared/ui/spinner';
import { PageEditor } from '@/src/widgets/editor';


const MISSING_CODES: ApiErrorCode[] = ['NOT_FOUND', 'FORBIDDEN', 'VALIDATION_ERROR'];

function CenteredArea({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
      {children}
    </div>
  );
}

export default function PageRoute() {
  const { pageId } = useParams<{ pageId: string }>();
  const { data: page, error, isPending } = usePage(pageId);


  if (isPending) {
    return (
      <CenteredArea>
        <Spinner size="lg" />
      </CenteredArea>
    );
  }

  if (!page) {
    // Удалённую страницу `usePage` отдаёт как `null` без ошибки; недоступную и
    // с битым id — ошибкой. Оборванная сеть приходит не `ApiClientError`:
    // `fetch` кидает `TypeError`.
    const isMissing =
      error === null || (error instanceof ApiClientError && MISSING_CODES.includes(error.code));

    // Чужую страницу показываем как ненайденную: нельзя сообщать, что она есть.
    return isMissing ? (
      <CenteredArea>
        <h1 className="text-heading-1 text-foreground">Страница не найдена</h1>
        <p className="text-body text-muted-foreground">Возможно, её удалили или ссылка неверна.</p>
        <Link href="/app" className="mt-2 text-body text-primary hover:underline">
          На главную
        </Link>
      </CenteredArea>
    ) : (
      <CenteredArea>
        <h1 className="text-heading-1 text-foreground">Не удалось загрузить страницу</h1>
        <p className="text-body text-muted-foreground">
          Сервис недоступен. Попробуйте обновить страницу позже.
        </p>
      </CenteredArea>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-page-title text-foreground">{page.title}</h1>
      <div className="mt-4">
        <PageEditor key={page.id} pageId={page.id} content={page.content} />
      </div>
    </div>
  );
}
