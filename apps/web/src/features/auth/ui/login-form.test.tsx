// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { routerReplace, searchParamsGet, loginMock } = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  searchParamsGet: vi.fn(),
  loginMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

vi.mock('../api/auth', () => ({
  login: loginMock,
}));

import { LoginForm } from './login-form';

beforeEach(() => {
  searchParamsGet.mockReturnValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'user@example.com');
  await user.type(screen.getByLabelText('Пароль'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Войти' }));
}

describe('LoginForm', () => {
  it('после входа ведёт на безопасный redirectUrl из query', async () => {
    searchParamsGet.mockReturnValue('/app/123');
    loginMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);

    expect(routerReplace).toHaveBeenCalledWith('/app/123');
  });

  it('после входа ведёт на /app, если redirectUrl небезопасный', async () => {
    searchParamsGet.mockReturnValue('https://evil.example');
    loginMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);

    expect(routerReplace).toHaveBeenCalledWith('/app');
  });

  it('после входа ведёт на /app, если redirectUrl отсутствует', async () => {
    loginMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);

    expect(routerReplace).toHaveBeenCalledWith('/app');
  });

  it('показывает доступный чекбокс, снятый по умолчанию', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const rememberMe = screen.getByRole('checkbox', { name: 'Запомнить меня' });

    expect(rememberMe).toBeEnabled();
    expect(rememberMe).not.toBeChecked();

    await user.click(rememberMe);

    expect(rememberMe).toBeChecked();
  });

  it('отправляет rememberMe: true при отмеченном чекбоксе', async () => {
    loginMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('checkbox', { name: 'Запомнить меня' }));
    await fillAndSubmit(user);

    expect(loginMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
      rememberMe: true,
    });
  });

  it('отправляет rememberMe: false при снятом чекбоксе', async () => {
    loginMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);

    expect(loginMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
      rememberMe: false,
    });
  });
});
