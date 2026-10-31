'use client';

import {
  calendarDateSchema,
  pageTitleSchema,
  type CreateCalendarPageInput,
  type UpdateCalendarEntryInput,
} from '@noto/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useForm } from 'react-hook-form';

import { calendarEntryKeys, useCalendarEntry } from '@/src/entities/calendar-entry';
import { pageKeys, usePage } from '@/src/entities/page';
import { useProject } from '@/src/entities/project';
import { ApiClientError } from '@/src/shared/api';
import { Button } from '@/src/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/src/shared/ui/dialog';
import { Input } from '@/src/shared/ui/input';
import { toast } from '@/src/shared/ui/toast';

import {
  CalendarMutationError,
  createCalendarPage,
  updateCalendarEntry,
} from '../api/calendar-mutations';

type Intent =
  | { kind: 'create'; projectId: string; context: string; input: CreateCalendarPageInput }
  | {
      kind: 'update';
      projectId: string;
      pageId: string;
      context: string;
      input: UpdateCalendarEntryInput;
    };

type Props = {
  projectId: string;
  initialDate: string;
  pageId?: string;
  onClose: () => void;
};

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос';
}

/** Одна локальная форма для экрана, Topbar и будущего блока редактора. */
export function CalendarEntryForm({ projectId, initialDate, pageId, onClose }: Props) {
  const client = useQueryClient();
  const project = useProject(projectId);
  const page = usePage(pageId);
  const point = useCalendarEntry(projectId, pageId);
  const canWrite =
    project.isSuccess &&
    (project.data?.currentUserRole === 'owner' || project.data?.currentUserRole === 'editor');
  const context = `${projectId}:${pageId ?? 'create'}`;
  const [formContext, setFormContext] = useState({
    original: context,
    observed: context,
    expired: false,
  });
  const originalContext = formContext.original;
  if (formContext.observed !== context) {
    setFormContext({ ...formContext, observed: context, expired: true });
  }
  const latest = useRef({ context, canWrite });
  const mounted = useRef(true);
  const discarded = useRef(false);
  const busy = useRef(false);
  const committed = useRef(false);
  const intent = useRef<Intent | null>(null);
  const priorUnknown = useRef(false);
  const initialRead = useRef<{ date: string | null } | null>(null);
  const [closed, setClosed] = useState(false);
  const [warning, setWarning] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState('');
  const [retryMode, setRetryMode] = useState<'write' | 'read' | null>(null);
  const [conflict, setConflict] = useState(false);
  const [freshDate, setFreshDate] = useState<string | null | undefined>();
  const [reached, setReached] = useState(false);
  const id = useId();
  const { register, handleSubmit, setValue, formState } = useForm({
    defaultValues: { title: '', date: initialDate },
  });

  useLayoutEffect(() => {
    latest.current = { context, canWrite };
  }, [context, canWrite]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (pageId && point.isSuccess && !initialRead.current) {
      initialRead.current = { date: point.data?.date ?? null };
      setValue('date', point.data?.date ?? initialDate);
    }
  }, [pageId, point.isSuccess, point.data, initialDate, setValue]);

  const finishClose = useCallback(() => {
    discarded.current = true;
    setClosed(true);
    setWarning(false);
    onClose();
  }, [onClose, setClosed, setWarning]);
  const requestClose = useCallback(() => {
    if (!pageId && ((busy.current && !committed.current) || priorUnknown.current)) setWarning(true);
    else finishClose();
  }, [pageId, finishClose, setWarning]);
  useEffect(() => {
    if (context !== originalContext) {
      // Возврат URL назад не возрождает намерение уже покинутого контекста.
      discarded.current = true;
      requestClose();
    }
  }, [context, originalContext, requestClose]);

  function current(candidate: Intent) {
    return mounted.current && !discarded.current && latest.current.context === candidate.context;
  }
  function writable(candidate?: Intent) {
    return (
      !discarded.current &&
      mounted.current &&
      latest.current.canWrite &&
      latest.current.context === originalContext &&
      (!candidate || current(candidate))
    );
  }

  async function readConflict(candidate: Intent) {
    setFreshDate(undefined);
    setRetryMode(null);
    try {
      const result = await point.refetch({ throwOnError: true });
      if (!current(candidate) || candidate.kind !== 'update') return;
      const actual = result.data?.date ?? null;
      if (actual === candidate.input.date) {
        setReached(true);
        setConflict(false);
        setError('Цель уже достигнута. Дата соответствует выбранной.');
      } else {
        setFreshDate(actual);
        setError('Дата изменилась. Подтвердите изменение после проверки текущей даты.');
      }
    } catch (failure) {
      if (current(candidate)) {
        setError(message(failure));
        setRetryMode('read');
      }
    }
  }

  const mutation = useMutation({
    retry: false,
    mutationFn: async (candidate: Intent) => {
      // Повторная проверка непосредственно перед отправкой, не только disabled UI.
      if (!writable(candidate)) throw new Error('Контекст или права проекта изменились');
      const result =
        candidate.kind === 'create'
          ? await createCalendarPage(candidate.projectId, candidate.input)
          : {
              entry: await updateCalendarEntry(
                candidate.projectId,
                candidate.pageId,
                candidate.input,
              ),
            };
      if (current(candidate)) {
        committed.current = true;
        priorUnknown.current = false;
      }
      const affectedPage =
        candidate.kind === 'create' && 'page' in result
          ? result.page.id
          : candidate.kind === 'update'
            ? candidate.pageId
            : undefined;
      let refreshFailed = false;
      try {
        await Promise.all([
          client.invalidateQueries({ queryKey: calendarEntryKeys.project(candidate.projectId) }),
          client.invalidateQueries({ queryKey: pageKeys.list(candidate.projectId) }),
          ...(affectedPage
            ? [client.invalidateQueries({ queryKey: pageKeys.detail(affectedPage) })]
            : []),
        ]);
      } catch {
        // POST/PUT уже подтверждён: сбой refetch не должен превращаться в retry записи.
        refreshFailed = true;
      }
      return { refreshFailed };
    },
    onSuccess: (result, candidate) => {
      busy.current = false;
      if (!current(candidate)) return;
      priorUnknown.current = false;
      if (result.refreshFailed) toast.error('Сохранено, но не удалось обновить данные');
      finishClose();
    },
    onError: async (failure, candidate) => {
      if (!current(candidate)) {
        busy.current = false;
        return;
      }
      setError(message(failure));
      const status = failure instanceof CalendarMutationError ? failure.status : undefined;
      if (candidate.kind === 'create') {
        const knownRejection = status !== undefined && [400, 401, 403, 404].includes(status);
        if (!knownRejection && status !== 409) priorUnknown.current = true;
        if (priorUnknown.current || status === 409) {
          setFrozen(true);
          setRetryMode(status === 409 ? null : 'write');
        } else {
          intent.current = null;
          setFrozen(false);
          setRetryMode(null);
        }
      } else if (status === 409) {
        setFrozen(true);
        setConflict(true);
        await readConflict(candidate);
      } else {
        setFrozen(true);
        setRetryMode('write');
      }
      busy.current = false;
    },
  });

  function send(candidate: Intent) {
    if (busy.current || !writable(candidate)) return;
    busy.current = true;
    committed.current = false;
    intent.current = candidate;
    setError('');
    setRetryMode(null);
    mutation.mutate(candidate);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit((values) => {
      if (!writable() || busy.current || frozen || conflict || reached) return;
      if (pageId) {
        if (!point.isSuccess || !initialRead.current) return;
        send({
          kind: 'update',
          context,
          projectId,
          pageId,
          input: {
            date: calendarDateSchema.parse(values.date),
            expectedDate: initialRead.current.date,
          },
        });
      } else {
        // Полный неизменный снимок создаётся до первого await/отправки.
        send({
          kind: 'create',
          context,
          projectId,
          input: {
            title: pageTitleSchema.parse(values.title),
            date: calendarDateSchema.parse(values.date),
            clientRequestId: crypto.randomUUID(),
          },
        });
      }
    })(event);
  }

  const pending = mutation.isPending;
  const validContext = !formContext.expired && context === originalContext;
  const unknown = Boolean(pageId) && !point.isSuccess;
  const accessDenied =
    point.error instanceof ApiClientError &&
    ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'].includes(point.error.code);
  const loadingFields =
    project.isPending ||
    project.isError ||
    accessDenied ||
    (Boolean(pageId) && point.data === undefined);
  const disabled = pending || frozen || !canWrite || !validContext || unknown;
  const shownError =
    error ||
    (project.isError ? message(project.error) : '') ||
    formState.errors.title?.message ||
    formState.errors.date?.message ||
    (pageId && point.isError ? message(point.error) : '');

  if (closed) return null;
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <DialogContent className="max-h-dvh overflow-y-auto">
          <DialogTitle>{pageId ? 'Дата страницы' : 'Создать страницу на дату'}</DialogTitle>
          <DialogDescription>
            {project.isSuccess ? (project.data?.name ?? 'Проект недоступен') : 'Календарь проекта'}
          </DialogDescription>
          <form
            className="flex min-w-0 flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy.current || !writable() || frozen || conflict || reached || unknown) return;
              submit(event);
            }}
          >
            {!loadingFields ? (
              <>
                <div className="space-y-2">
                  <label className="text-label" htmlFor={`${id}-title`}>
                    Заголовок
                  </label>
                  {pageId ? (
                    <Input id={`${id}-title`} readOnly value={page.data?.title ?? ''} />
                  ) : (
                    <Input
                      id={`${id}-title`}
                      disabled={disabled}
                      aria-invalid={Boolean(formState.errors.title)}
                      {...register('title', {
                        validate: (value) =>
                          pageTitleSchema.safeParse(value).success ||
                          'Заголовок должен содержать от 1 до 200 символов',
                      })}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-label" htmlFor={`${id}-date`}>
                    Дата
                  </label>
                  <Input
                    id={`${id}-date`}
                    type="date"
                    disabled={disabled}
                    aria-invalid={Boolean(formState.errors.date)}
                    {...register('date', {
                      validate: (value) =>
                        calendarDateSchema.safeParse(value).success || 'Укажите календарную дату',
                    })}
                  />
                </div>
              </>
            ) : null}
            {(unknown || project.isPending) && !shownError ? (
              <p role="status">Загрузка даты…</p>
            ) : null}
            {shownError ? (
              <p role="alert" className="break-words text-body text-destructive">
                {shownError}
              </p>
            ) : null}
            {conflict && !reached ? (
              <>
                {freshDate !== undefined ? (
                  <p className="text-body">Текущая дата: {freshDate ?? 'не назначена'}</p>
                ) : null}
                <Button
                  type="button"
                  disabled={pending || !canWrite || !validContext || freshDate === undefined}
                  onClick={() => {
                    const candidate = intent.current;
                    if (
                      candidate?.kind !== 'update' ||
                      freshDate === undefined ||
                      !writable(candidate)
                    )
                      return;
                    setConflict(false);
                    send({
                      ...candidate,
                      input: { date: candidate.input.date, expectedDate: freshDate },
                    });
                  }}
                >
                  Подтвердить изменение
                </Button>
              </>
            ) : null}
            {retryMode || (pageId && point.isError && !conflict) ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending || point.isFetching || !canWrite || !validContext}
                onClick={() => {
                  if (!writable() || busy.current) return;
                  const candidate = intent.current;
                  if (retryMode === 'write' && candidate) send(candidate);
                  else if (retryMode === 'read' && candidate) void readConflict(candidate);
                  else void point.refetch();
                }}
              >
                Повторить
              </Button>
            ) : null}
            <DialogFooter className="flex-wrap">
              {pageId && point.isSuccess && point.data && !frozen ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || !canWrite || !validContext}
                  onClick={() => {
                    if (!initialRead.current) return;
                    send({
                      kind: 'update',
                      context,
                      projectId,
                      pageId,
                      input: {
                        date: null,
                        expectedDate: initialRead.current.date,
                      },
                    });
                  }}
                >
                  Снять дату
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={requestClose}>
                Отмена
              </Button>
              <Button type="submit" disabled={disabled || conflict || reached}>
                {pageId ? 'Сохранить' : 'Создать'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={warning} onOpenChange={setWarning}>
        <DialogContent>
          <DialogTitle>Закрыть форму?</DialogTitle>
          <DialogDescription>
            Результат неизвестен: проверьте созданные страницы перед новым намерением
          </DialogDescription>
          <DialogFooter className="flex-wrap">
            <Button variant="secondary" onClick={() => setWarning(false)}>
              Продолжить
            </Button>
            <Button onClick={finishClose}>Закрыть форму</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
