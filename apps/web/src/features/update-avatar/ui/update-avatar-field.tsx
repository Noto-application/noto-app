'use client';

import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';

import { getAvatarColor, type User } from '@/src/entities/user';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/shared/ui/avatar';
import { Button } from '@/src/shared/ui/button';

import { useRemoveAvatar, useUpdateAvatar } from '../api/use-update-avatar';
import { validateAvatarFile } from '../lib/validate-avatar-file';
import { useAvatarPreview } from '../model/avatar-preview';

export function UpdateAvatarField({ user }: { user: User }) {
  const mutation = useUpdateAvatar();
  const removeAvatar = useRemoveAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const avatarUrl = useAvatarPreview(user.id);
  const displayName = user.username ?? user.email;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    mutation.mutate(file);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Avatar size="xl" style={{ backgroundColor: getAvatarColor(user.id) }}>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            loading={mutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            Изменить
          </Button>
          {avatarUrl ? (
            <Button type="button" variant="ghost" onClick={removeAvatar}>
              Удалить
            </Button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error ? (
        <p className="text-label text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-label text-muted-foreground">
        Прототип без сохранения на сервере — изменения видны только в этой сессии (issue #126).
      </p>
    </div>
  );
}
