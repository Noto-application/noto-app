'use client';

import { createContext, useContext, useRef, type ReactNode } from 'react';

import { useCreatePage } from '../api/use-create-page';

type CreatePageAction = {
  create: () => void;
  isPending: boolean;
  isProjectsPending: boolean;
  isProjectsError: boolean;
  isActiveProjectPending: boolean;
  isActiveProjectError: boolean;
};

const CreatePageContext = createContext<CreatePageAction | null>(null);

/** Одна мутация на весь app shell, чтобы две кнопки не создавали дубликаты. */
export function CreatePageProvider({ children }: { children: ReactNode }) {
  const operation = useCreatePage();
  const isCreatingRef = useRef(false);

  const create = () => {
    if (
      isCreatingRef.current ||
      operation.isPending ||
      operation.isActiveProjectPending ||
      operation.isActiveProjectError
    ) {
      return;
    }

    isCreatingRef.current = true;
    operation.mutate(undefined, {
      onSettled: () => {
        isCreatingRef.current = false;
      },
    });
  };

  return (
    <CreatePageContext.Provider
      value={{
        create,
        isPending: operation.isPending,
        isProjectsPending: operation.isProjectsPending,
        isProjectsError: operation.isProjectsError,
        isActiveProjectPending: operation.isActiveProjectPending,
        isActiveProjectError: operation.isActiveProjectError,
      }}
    >
      {children}
    </CreatePageContext.Provider>
  );
}

export function useCreatePageAction(): CreatePageAction {
  const context = useContext(CreatePageContext);

  if (!context) {
    throw new Error('useCreatePageAction must be used within CreatePageProvider');
  }

  return context;
}
