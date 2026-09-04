'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginBodySchema, type LoginCredentials } from '@noto/shared/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';

import { login } from '@/src/features/auth/api/auth';
import { Button } from '@/src/shared/ui/button';
import { Checkbox } from '@/src/shared/ui/checkbox';

import { getAuthFormError } from '../lib/get-auth-error-message';
import { AuthLayout } from './auth-layout';
import { FormField } from './form-field';
import { PasswordField } from './password-field';

type LoginFormValues = LoginCredentials;

export function LoginForm() {
  const router = useRouter();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });
  const rememberMe = useWatch({ control: form.control, name: 'rememberMe' });

  async function onSubmit(credentials: LoginFormValues) {
    try {
      await login(credentials);
      router.replace('/app');
    } catch (error) {
      const { field, message } = getAuthFormError(error);
      form.setError(field ?? 'root', { message });
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h1 className="text-page-title">Войти</h1>
        <p className="text-body text-muted-foreground">Продолжайте работу с вашими заметками.</p>
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
          id="login-email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          label="Email"
          placeholder="you@example.com"
          type="email"
          {...form.register('email')}
        />
        <PasswordField
          id="login-password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          placeholder="Введите пароль"
          {...form.register('password')}
        />

        <label className="flex items-center gap-2 text-body-compact text-muted-foreground">
          <Checkbox
            checked={rememberMe}
            id="login-remember-me"
            name="rememberMe"
            onCheckedChange={(rememberMe) => form.setValue('rememberMe', rememberMe)}
          />
          Запомнить меня
        </label>

        <Button className="w-full" loading={form.formState.isSubmitting} type="submit">
          Войти
        </Button>
      </form>

      <p className="mt-6 text-center text-body-compact text-muted-foreground">
        Нет аккаунта?{' '}
        <Link className="text-primary hover:underline" href="/register">
          Зарегистрироваться
        </Link>
      </p>
    </AuthLayout>
  );
}
