'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { useTrashPages } from '@/src/entities/page';
import { useProjects } from '@/src/entities/project';
import { RestorePageButton } from '@/src/features/restore-page';
import { ApiClientError } from '@/src/shared/api';
import { getTrashHref, getTrashProjectId } from '@/src/shared/lib/trash-navigation';
import { Button } from '@/src/shared/ui/button';

import { TrashPageRow } from './trash-page-row';

function loadErrorMessage(error: Error) {
  if (error instanceof ApiClientError) {
    if (error.code === 'FORBIDDEN') return 'У вас нет доступа к корзине этого проекта.';
    if (error.code === 'NOT_FOUND') return 'Проект удалён или недоступен.';
  }
  return 'Не удалось загрузить корзину. Попробуйте ещё раз.';
}

function ProjectTrash({ projectId }: { projectId: string }) {
  const query = useTrashPages(projectId);
  if (query.isPending) return <p role="status">Загрузка корзины…</p>;

  const denied =
    query.error instanceof ApiClientError && ['FORBIDDEN', 'NOT_FOUND'].includes(query.error.code);
  if ((query.isError && !query.data) || denied) {
    return (
      <div className="space-y-3">
        <p role="alert">{loadErrorMessage(query.error!)}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  // Keyset не является снапшотом: при изменениях между порциями id может повториться.
  const rows = [
    ...new Map(
      query.data?.pages.flatMap((portion) => portion.pages).map((page) => [page.id, page]),
    ).values(),
  ];

  return (
    <div className="space-y-4" aria-busy={query.isFetching}>
      {query.isError ? (
        <div className="space-y-2">
          <p role="alert">
            {query.isFetchNextPageError
              ? 'Не удалось загрузить следующие страницы.'
              : 'Не удалось обновить корзину.'}
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
            }
          >
            Повторить
          </Button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Корзина пуста</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((page) => (
            <TrashPageRow
              key={page.id}
              page={page}
              action={<RestorePageButton projectId={projectId} pageId={page.id} />}
            />
          ))}
        </ul>
      )}
      {query.hasNextPage ? (
        <Button
          variant="secondary"
          loading={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          Показать ещё
        </Button>
      ) : null}
    </div>
  );
}

export function PageTrash() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projects = useProjects();
  const rawProjectId = searchParams.get('projectId');
  const projectId = getTrashProjectId(rawProjectId);

  return (
    <section
      className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-8"
      aria-labelledby="trash-heading"
    >
      <header className="space-y-2">
        <h1 id="trash-heading" className="text-heading-1">
          Корзина
        </h1>
        <p className="text-body text-muted-foreground">
          Удалённые страницы проекта. Восстанавливайте каждую страницу отдельно.
        </p>
      </header>
      <div className="space-y-2">
        <label className="block text-body-compact font-medium" htmlFor="trash-project">
          Проект
        </label>
        <select
          id="trash-project"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-body sm:max-w-sm"
          value={projectId ?? ''}
          onChange={(event) => router.push(getTrashHref(event.target.value))}
        >
          <option value="">Выберите проект</option>
          {projectId && !projects.data?.some((project) => project.id === projectId) ? (
            <option value={projectId}>Текущий проект</option>
          ) : null}
          {projects.data?.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        {projects.isPending ? <p role="status">Загрузка проектов…</p> : null}
        {projects.isError ? (
          <div className="space-y-2">
            <p role="alert">Не удалось загрузить список проектов.</p>
            <Button
              variant="secondary"
              loading={projects.isFetching}
              onClick={() => void projects.refetch()}
            >
              Повторить загрузку проектов
            </Button>
          </div>
        ) : null}
        {projects.isSuccess && projects.data.length === 0 ? (
          <p className="text-muted-foreground">Нет доступных проектов.</p>
        ) : null}
      </div>
      {rawProjectId !== null && !projectId ? (
        <p role="alert">Некорректный идентификатор проекта. Выберите проект из списка.</p>
      ) : null}
      {projectId ? (
        <ProjectTrash key={projectId} projectId={projectId} />
      ) : (
        <p className="text-muted-foreground">Выберите проект, чтобы открыть его корзину.</p>
      )}
    </section>
  );
}
