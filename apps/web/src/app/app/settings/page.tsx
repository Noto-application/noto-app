'use client';

import { useCurrentUser } from '@/src/entities/user';
import { UpdateUsernameForm } from '@/src/features/update-username';
import { Spinner } from '@/src/shared/ui/spinner';

export default function SettingsPage() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-heading-1 text-foreground">Настройки профиля</h1>
      {user ? (
        <div className="mt-6">
          <UpdateUsernameForm user={user} />
        </div>
      ) : null}
    </div>
  );
}
