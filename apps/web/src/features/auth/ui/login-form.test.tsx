// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    searchParamsGet.mockReturnValue(null);
    loginMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);

    expect(routerReplace).toHaveBeenCalledWith('/app');
  });
});
