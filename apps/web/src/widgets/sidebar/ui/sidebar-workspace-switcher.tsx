import { Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import type { useProjectContext } from '@/src/features/create-page';
import { Button } from '@/src/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/src/shared/ui/dropdown-menu';

export function SidebarWorkspaceSwitcher({
  context,
}: {
  context: ReturnType<typeof useProjectContext>;
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const { projects, projectId, project } = context;
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={trigger}
          disabled={projects.isPending || !projects.data?.length}
          render={
            <Button
              className="w-full justify-between px-2"
              variant="ghost"
              aria-label="Переключить рабочее пространство"
            >
              <span className="truncate text-body-compact font-medium">
                {project?.name ?? (projectId ? `Проект ${projectId}` : 'Выберите проект')}
              </span>
              <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start">
          {projects.data?.map((item) => (
            <DropdownMenuItem
              key={item.id}
              aria-current={item.id === projectId ? 'true' : undefined}
              onClick={() => {
                trigger.current?.focus();
                if (item.id !== projectId) router.push(`/app?projectId=${item.id}`);
              }}
            >
              <span className="flex-1 truncate">{item.name}</span>
              {item.id === projectId ? <Check aria-hidden="true" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {projects.isPending ? <p role="status">Загрузка проектов…</p> : null}
      {projects.isError ? (
        <div className="p-2 text-body-compact">
          <p>Не удалось загрузить проекты</p>
          <Button variant="ghost" size="sm" onClick={() => void projects.refetch()}>
            Повторить список проектов
          </Button>
        </div>
      ) : null}
    </div>
  );
}
