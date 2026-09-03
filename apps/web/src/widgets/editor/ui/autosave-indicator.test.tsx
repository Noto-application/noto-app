// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AutosaveIndicator } from './autosave-indicator';

describe('AutosaveIndicator', () => {
  it('ничего не показывает в состоянии idle', () => {
    const { container } = render(<AutosaveIndicator status="idle" onRetry={vi.fn()} />);

    expect(container.querySelector('[aria-live]')).toBeEmptyDOMElement();
  });

  it.each([
    ['saving', 'Сохранение…'],
    ['saved', 'Сохранено'],
  ] as const)('показывает текст для статуса %s', (status, text) => {
    render(<AutosaveIndicator status={status} onRetry={vi.fn()} />);

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('при ошибке показывает сообщение и кнопку «Повторить», которая зовёт onRetry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<AutosaveIndicator status="error" onRetry={onRetry} />);

    expect(screen.getByText('Не удалось сохранить')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('оборачивает статус в aria-live="polite" для скринридеров', () => {
    const { container } = render(<AutosaveIndicator status="saving" onRetry={vi.fn()} />);

    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
