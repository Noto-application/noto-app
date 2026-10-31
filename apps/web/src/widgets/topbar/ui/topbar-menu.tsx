'use client';

import { MoreHorizontal } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { useCalendarEntry } from '@/src/entities/calendar-entry';
import { usePage } from '@/src/entities/page';
import { useProject } from '@/src/entities/project';
import { CalendarEntryForm } from '@/src/features/calendar-entry';
import { Button } from '@/src/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/shared/ui/dropdown-menu';

export function TopbarMenu() {
  const params = useParams<{ pageId?: string }>();
  const pageId = typeof params.pageId === 'string' ? params.pageId : undefined;
  const page = usePage(pageId);
  const project = useProject(page.data?.projectId);
  const canWrite =
    page.isSuccess &&
    project.isSuccess &&
    (project.data?.currentUserRole === 'owner' || project.data?.currentUserRole === 'editor');
  const point = useCalendarEntry(canWrite ? page.data?.projectId : undefined, pageId);
  const [editing, setEditing] = useState(false);
  const today = new Date();
  const localDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Меню страницы"
              size="icon"
              variant="ghost"
              disabled={!page.data || !canWrite}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {point.isPending ? (
            <p role="status" className="p-2 text-body">
              Загрузка даты…
            </p>
          ) : null}
          {point.isError ? (
            <div className="space-y-2 p-2">
              <p role="alert" className="text-body text-destructive">
                Не удалось загрузить дату
              </p>
              <Button variant="secondary" onClick={() => void point.refetch()}>
                Повторить
              </Button>
            </div>
          ) : null}
          {canWrite && point.isSuccess ? (
            point.data ? (
              <>
                <DropdownMenuItem onClick={() => setEditing(true)}>Сменить дату</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditing(true)}>Снять дату</DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => setEditing(true)}>Назначить дату</DropdownMenuItem>
            )
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && page.data ? (
        <CalendarEntryForm
          projectId={page.data.projectId}
          pageId={pageId}
          initialDate={point.data?.date ?? localDay}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}
