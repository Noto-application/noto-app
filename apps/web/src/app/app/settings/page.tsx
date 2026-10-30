'use client';

import { useCurrentUser } from '@/src/entities/user';
import { UpdateUsernameForm } from '@/src/features/update-username';
import { Button } from '@/src/shared/ui/button';
import { Spinner } from '@/src/shared/ui/spinner';

export default function SettingsPage() {
  const { data: user, isLoading, isError, refetch } = useCurrentUser();

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
      {isError ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="text-body text-muted-foreground">Не удалось загрузить профиль.</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Повторить
          </Button>
        </div>
      ) : null}
      {user ? (
        <div className="mt-6">
          <UpdateUsernameForm user={user} />
        </div>
      ) : null}
    </div>
  );
}
