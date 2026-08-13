'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { authCredentialsSchema, type AuthCredentials } from '@noto/shared/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { register } from '@/src/features/auth/api/auth';
import { Button } from '@/src/shared/ui/button';

import { getAuthFormError } from '../lib/get-auth-error-message';
import { AuthLayout } from './auth-layout';
import { FormField } from './form-field';
import { PasswordField } from './password-field';

type RegisterFormValues = AuthCredentials;

export function RegisterForm() {
  const router = useRouter();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(authCredentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(credentials: RegisterFormValues) {
    try {
      await register(credentials);
      router.replace('/app');
    } catch (error) {
      const { field, message } = getAuthFormError(error);
      form.setError(field ?? 'root', { message });
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h1 className="text-page-title">Создать аккаунт</h1>
        <p className="text-body text-muted-foreground">
          Начните организовывать знания вместе с Noto.
        </p>
      </div>

      <form
        className="mt-7 space-y-5"
        noValidate
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      >
        {form.formState.errors.root ? (
          <p
            className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-body-compact text-status-danger-text"
            role="alert"
          >
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <FormField
          id="register-email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          label="Email"
          placeholder="you@example.com"
          type="email"
          {...form.register('email')}
        />
        <PasswordField
          id="register-password"
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          label="Пароль"
          placeholder="Не менее 8 символов"
          {...form.register('password')}
        />

        <Button className="w-full" loading={form.formState.isSubmitting} type="submit">
          Зарегистрироваться
        </Button>
      </form>

      <p className="mt-6 text-center text-body-compact text-muted-foreground">
        Уже есть аккаунт?{' '}
        <Link className="text-primary hover:underline" href="/login">
          Войти
        </Link>
      </p>
    </AuthLayout>
  );
}
