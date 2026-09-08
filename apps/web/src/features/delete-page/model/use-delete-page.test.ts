// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeletePage } from './use-delete-page';

const {
  useDeletePageMutationMock,
  useRouterMock,
  routerPushMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  useDeletePageMutationMock: vi.fn(),
  useRouterMock: vi.fn(),
  routerPushMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: useRouterMock,
}));

vi.mock('@/src/entities/page', () => ({
  useDeletePageMutation: useDeletePageMutationMock,
}));

vi.mock('@/src/shared/ui/toast', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();

  useRouterMock.mockReturnValue({
    push: routerPushMock,
  });

  useDeletePageMutationMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
});

describe('useDeletePage', () => {
  it('изначально держит диалог закрытым', () => {
    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    expect(result.current.open).toBe(false);
  });

  it('открывает диалог через onOpen', () => {
    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onOpen();
    });

    expect(result.current.open).toBe(true);
  });

  it('закрывает диалог через onOpenChange', () => {
    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onOpen();
    });

    expect(result.current.open).toBe(true);

    act(() => {
      result.current.onOpenChange(false);
    });

    expect(result.current.open).toBe(false);
  });

  it('не открывает диалог во время удаления', () => {
    useDeletePageMutationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });

    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onOpen();
    });

    expect(result.current.open).toBe(false);
  });

  it('не изменяет состояние открытия во время удаления', () => {
    useDeletePageMutationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });

    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onOpenChange(true);
    });

    expect(result.current.open).toBe(false);
  });

  it('передаёт pageId в mutation при удалении', () => {
    const mutate = vi.fn();

    useDeletePageMutationMock.mockReturnValue({
      mutate,
      isPending: false,
    });

    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-42',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onDelete();
    });

    expect(mutate).toHaveBeenCalledWith(
      'page-42',
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('после успешного удаления закрывает диалог', () => {
    const mutate = vi.fn();

    useDeletePageMutationMock.mockReturnValue({
      mutate,
      isPending: false,
    });

    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onOpen();
    });

    expect(result.current.open).toBe(true);

    act(() => {
      result.current.onDelete();
    });

    const [, options] = mutate.mock.calls[0];

    act(() => {
      options.onSuccess();
    });

    expect(result.current.open).toBe(false);
  });

  it('после успешного удаления показывает success toast', () => {
    const mutate = vi.fn();

    useDeletePageMutationMock.mockReturnValue({
      mutate,
      isPending: false,
    });

    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onDelete();
    });

    const [, options] = mutate.mock.calls[0];

    act(() => {
      options.onSuccess();
    });

    expect(toastSuccessMock).toHaveBeenCalledWith(
      'Страница удалена',
      '«Обзор» и её дочерние страницы удалены.',
    );
  });

  it('после успешного удаления перенаправляет на /app', () => {
    const mutate = vi.fn();

    useDeletePageMutationMock.mockReturnValue({
      mutate,
      isPending: false,
    });

    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onDelete();
    });

    const [, options] = mutate.mock.calls[0];

    act(() => {
      options.onSuccess();
    });

    expect(routerPushMock).toHaveBeenCalledWith('/app');
  });

  it('после ошибки удаления показывает error toast', () => {
    const mutate = vi.fn();

    useDeletePageMutationMock.mockReturnValue({
      mutate,
      isPending: false,
    });

    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onDelete();
    });

    const [, options] = mutate.mock.calls[0];

    act(() => {
      options.onError();
    });

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Не удалось удалить страницу',
      'Попробуйте ещё раз.',
    );
  });

  it('не перенаправляет на /app при ошибке удаления', () => {
    const mutate = vi.fn();

    useDeletePageMutationMock.mockReturnValue({
      mutate,
      isPending: false,
    });

    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    act(() => {
      result.current.onDelete();
    });

    const [, options] = mutate.mock.calls[0];

    act(() => {
      options.onError();
    });

    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it('возвращает состояние isPending mutation', () => {
    useDeletePageMutationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });

    const { result } = renderHook(() =>
      useDeletePage({
        pageId: 'page-1',
        title: 'Обзор',
      }),
    );

    expect(result.current.isPending).toBe(true);
  });
});
