// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

if (!window.PointerEvent) {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
}

const { login, replace } = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('../api/auth', () => ({ login }));

import { LoginForm } from './login-form';

afterEach(() => {
  vi.clearAllMocks();
});

async function submitLoginForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'you@example.com');
  await user.type(screen.getByLabelText('Пароль'), 'password');
  await user.click(screen.getByRole('button', { name: 'Войти' }));
}

describe('LoginForm', () => {
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
    const user = userEvent.setup();
    login.mockResolvedValue({});
    render(<LoginForm />);

    await user.click(screen.getByRole('checkbox', { name: 'Запомнить меня' }));
    await submitLoginForm(user);

    expect(login).toHaveBeenCalledWith({
      email: 'you@example.com',
      password: 'password',
      rememberMe: true,
    });
  });

  it('отправляет rememberMe: false при снятом чекбоксе', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({});
    render(<LoginForm />);

    await submitLoginForm(user);

    expect(login).toHaveBeenCalledWith({
      email: 'you@example.com',
      password: 'password',
      rememberMe: false,
    });
  });
});
