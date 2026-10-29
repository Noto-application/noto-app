'use client';

import { getAvatarColor, useCurrentUser } from '@/src/entities/user';
import { useAvatarPreview } from '@/src/features/update-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/shared/ui/avatar';
import { Skeleton } from '@/src/shared/ui/skeleton';

export function SidebarUserBlock() {
  const { data: user, isLoading } = useCurrentUser();
  const avatarUrl = useAvatarPreview(user?.id);

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
      <Avatar style={user ? { backgroundColor: getAvatarColor(user.id) } : undefined}>
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback>{displayName ? displayName.charAt(0).toUpperCase() : '?'}</AvatarFallback>
      </Avatar>
      <span className="truncate text-body-compact text-foreground">{displayName ?? '—'}</span>
    </div>
  );
}
