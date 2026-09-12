'use client';

import type { ComponentProps } from 'react';

import { Button } from '@/src/shared/ui/button';

import { useCreatePageAction } from '../model/create-page-context';

type CreatePageButtonProps = Omit<
  ComponentProps<typeof Button>,
  'disabled' | 'loading' | 'onClick'
>;

/** Кнопка общей операции создания страницы для стартового экрана и сайдбара. */
export function CreatePageButton({ children, ...props }: CreatePageButtonProps) {
  const { create, isPending, isActiveProjectPending, isActiveProjectError } = useCreatePageAction();

  return (
    <Button
      {...props}
      loading={isPending}
      disabled={isActiveProjectPending || isActiveProjectError}
      onClick={create}
    >
      {children}
    </Button>
  );
}
