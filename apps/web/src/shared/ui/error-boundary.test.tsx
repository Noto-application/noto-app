// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './error-boundary';

function Bomb(): never {
  throw new Error('boom');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('рендерит детей, когда ошибки нет', () => {
    render(
      <ErrorBoundary fallback={<p>Фолбэк</p>}>
        <p>Всё в порядке</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Всё в порядке')).toBeInTheDocument();
    expect(screen.queryByText('Фолбэк')).not.toBeInTheDocument();
  });

  it('рендерит фолбэк и логирует ошибку, если ребёнок бросил при рендере', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<p>Фолбэк</p>}>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Фолбэк')).toBeInTheDocument();
    expect(consoleError.mock.calls.some((call) => call[0] === 'Ошибка в дереве компонентов')).toBe(
      true,
    );
  });
});
