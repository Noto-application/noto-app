'use client';

import { calendarContract } from '@noto/shared';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { useCalendarEntries } from '@/src/entities/calendar-entry';
import { useProjects } from '@/src/entities/project';
import { ApiClientError } from '@/src/shared/api';
import { Button } from '@/src/shared/ui/button';
import type { MonthGridRange } from '@/src/shared/ui/calendar/month-grid';
import { InlineAlert } from '@/src/shared/ui/inline-alert';

const MonthGrid = dynamic(
  () => import('@/src/shared/ui/calendar/month-grid').then((module) => module.MonthGrid),
  {
    ssr: false,
    loading: () => <p className="text-body text-muted-foreground">Подготавливаем сетку…</p>,
  },
);

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear().toString().padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function adjacentMonth(month: string, delta: number) {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + number - 1 + delta;
  const nextYear = Math.floor(index / 12);
  return nextYear >= 1 && nextYear <= 9999
    ? `${String(nextYear).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
    : null;
}

function CalendarLoading() {
  return (
    <p role="status" className="py-4 text-body text-muted-foreground">
      Загрузка календаря…
    </p>
  );
}

function CalendarRange({ projectId, month }: { projectId: string; month: string }) {
  const router = useRouter();
  const [range, setRange] = useState<MonthGridRange>();
  const query = useCalendarEntries(projectId, range?.from, range?.to);
  const onRangeChange = useCallback((next: MonthGridRange) => {
    setRange((previous) =>
      previous?.from === next.from && previous.to === next.to ? previous : next,
    );
  }, []);

  const transientError =
    query.error instanceof TypeError ||
    (query.error instanceof ApiClientError && query.error.code === 'INTERNAL');
  const staleWarning = query.isError && query.data !== undefined && transientError;

  if (query.isError && !staleWarning) {
    if (query.error instanceof ApiClientError && query.error.code === 'FORBIDDEN') {
      return <p className="py-8 text-body text-muted-foreground">Доступ запрещён</p>;
    }
    if (query.error instanceof ApiClientError && query.error.code === 'NOT_FOUND') {
      return <p className="py-8 text-body text-muted-foreground">Проект недоступен</p>;
    }
    return (
      <div className="space-y-3 py-8">
        <p role="alert" className="text-body text-destructive">
          Не удалось загрузить календарь
        </p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {query.isPending ? <CalendarLoading /> : null}
      {query.data?.length === 0 ? (
        <p className="text-body text-muted-foreground">Нет запланированных страниц</p>
      ) : null}
      {staleWarning ? (
        <InlineAlert variant="warning" role="alert">
          <div className="flex flex-wrap items-center gap-3">
            <p>Не удалось обновить календарь</p>
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              Повторить
            </Button>
          </div>
        </InlineAlert>
      ) : null}
      <MonthGrid
        month={month}
        items={(query.data ?? []).map(({ pageId, title, date }) => ({
          id: pageId,
          label: title,
          date,
        }))}
        onRangeChange={onRangeChange}
        onItemClick={(pageId) => router.push(`/app/${pageId}`)}
      />
    </div>
  );
}

function CalendarScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const projects = useProjects();
  const rawProjectId = params.get('projectId');
  const rawMonth = params.get('month');
  const validProject =
    rawProjectId === null ||
    calendarContract.list.pathParams.safeParse({ projectId: rawProjectId }).success;
  const validMonth =
    rawMonth === null || (/^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) && !rawMonth.startsWith('0000'));
  const invalid = !validProject || !validMonth;
  const firstProject = projects.data?.[0];
  const projectId = rawProjectId ?? firstProject?.id;
  const month = rawMonth ?? currentMonth();

  const calendarUrl = (project: string, targetMonth: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('projectId', project);
    next.set('month', targetMonth);
    return `${pathname}?${next.toString()}`;
  };
  const canonical =
    !invalid && projectId && (rawProjectId === null || rawMonth === null)
      ? calendarUrl(projectId, month)
      : null;
  const lastCanonical = useRef<string | null>(null);
  useEffect(() => {
    if (canonical && canonical !== lastCanonical.current) router.replace(canonical);
    lastCanonical.current = canonical;
  }, [canonical, router]);

  const projectError = (
    <div className="space-y-3 py-4">
      <p role="alert" className="text-body text-destructive">
        Не удалось загрузить проекты
      </p>
      <Button variant="secondary" onClick={() => void projects.refetch()}>
        Повторить
      </Button>
    </div>
  );

  let content;
  if (invalid) {
    content = (
      <div className="space-y-4 py-8">
        <p className="text-body">Невалидная ссылка</p>
        {projects.isPending ? (
          <CalendarLoading />
        ) : projects.isError ? (
          projectError
        ) : firstProject ? (
          <Button
            variant="secondary"
            onClick={() => router.replace(calendarUrl(firstProject.id, currentMonth()))}
          >
            Открыть календарь
          </Button>
        ) : (
          <p className="text-body text-muted-foreground">Нет проектов</p>
        )}
      </div>
    );
  } else if (projects.isPending) {
    content = <CalendarLoading />;
  } else if (projects.isError) {
    content = projectError;
  } else if (!projectId) {
    content = <p className="py-8 text-body text-muted-foreground">Нет проектов</p>;
  } else {
    const previous = adjacentMonth(month, -1);
    const next = adjacentMonth(month, 1);
    const project = projects.data.find((item) => item.id === projectId);
    content = (
      <>
        <p className="truncate text-body text-muted-foreground" aria-label="Текущий проект">
          {project?.name ?? `Проект ${projectId}`}
        </p>
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Предыдущий месяц"
            disabled={!previous}
            onClick={() => previous && router.push(calendarUrl(projectId, previous))}
          >
            <ChevronLeft />
          </Button>
          <h2 className="min-w-0 text-heading-3 text-foreground">
            {new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' }).format(
              new Date(`${month}-01T12:00:00`),
            )}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Следующий месяц"
            disabled={!next}
            onClick={() => next && router.push(calendarUrl(projectId, next))}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(calendarUrl(projectId, currentMonth()))}
          >
            Сегодня
          </Button>
        </div>
        {/* Новый URL-контекст не наследует диапазон или карточки предыдущей сетки. */}
        <CalendarRange key={`${projectId}:${month}`} projectId={projectId} month={month} />
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-8">
      <h1 className="flex items-center gap-2 text-heading-1 text-foreground">
        <CalendarDays className="size-6 text-muted-foreground" aria-hidden="true" />
        Календарь
      </h1>
      {content}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarScreen />
    </Suspense>
  );
}
