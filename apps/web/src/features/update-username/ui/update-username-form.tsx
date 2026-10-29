'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { updateUserSchema, type User } from '@noto/shared/api';
import { useForm } from 'react-hook-form';

import { Button } from '@/src/shared/ui/button';
import { Input } from '@/src/shared/ui/input';

import { useUpdateUsername } from '../api/use-update-username';

type UpdateUsernameFormValues = { username: string };

export function UpdateUsernameForm({ user }: { user: User }) {
  const mutation = useUpdateUsername();
  const form = useForm<UpdateUsernameFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { username: user.username ?? '' },
  });

  function onSubmit(values: UpdateUsernameFormValues) {
    mutation.mutate(values.username);
  }

  return (
    <form
      className="max-w-md space-y-5"
      noValidate
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
    >
      <div className="space-y-1.5">
        <span className="text-label font-medium text-foreground">Email</span>
        <p className="text-body text-muted-foreground">{user.email}</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-label font-medium text-foreground" htmlFor="settings-username">
          Имя
        </label>
        <Input
          id="settings-username"
          aria-describedby={form.formState.errors.username ? 'settings-username-error' : undefined}
          aria-invalid={Boolean(form.formState.errors.username)}
          placeholder="Без имени"
          {...form.register('username')}
        />
        {form.formState.errors.username ? (
          <p id="settings-username-error" className="text-label text-destructive" role="alert">
            {form.formState.errors.username.message}
          </p>
        ) : null}
      </div>

      <Button loading={mutation.isPending} type="submit">
        Сохранить
      </Button>
    </form>
  );
}
