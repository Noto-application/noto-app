'use client';

import { useCurrentUser } from '@/src/entities/user';
import { Avatar, AvatarFallback } from '@/src/shared/ui/avatar';
import { Skeleton } from '@/src/shared/ui/skeleton';

export function SidebarUserBlock() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  const displayName = user?.username ?? user?.email;

  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
      <Avatar>
        <AvatarFallback>{displayName ? displayName.charAt(0).toUpperCase() : '?'}</AvatarFallback>
      </Avatar>
      <span className="truncate text-body-compact text-foreground">{displayName ?? '—'}</span>
    </div>
  );
}
