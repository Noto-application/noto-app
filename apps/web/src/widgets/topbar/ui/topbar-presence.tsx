import { Avatar, AvatarFallback, AvatarGroup } from '@/src/shared/ui/avatar';

export function TopbarPresence() {
  return (
    <AvatarGroup aria-hidden="true">
      <Avatar size="sm">
        <AvatarFallback>А</AvatarFallback>
      </Avatar>
      <Avatar size="sm">
        <AvatarFallback>М</AvatarFallback>
      </Avatar>
    </AvatarGroup>
  );
}
