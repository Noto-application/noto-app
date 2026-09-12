// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CollabSyncIndicator } from './sync-indicator';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CollabSyncIndicator', () => {
  it('synced без неотправленных правок → ничего не рендерит', () => {
    const { container } = render(<CollabSyncIndicator status="synced" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('connecting → Connecting…', () => {
    render(<CollabSyncIndicator status="connecting" />);
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('disconnected → Reconnecting…', () => {
    render(<CollabSyncIndicator status="disconnected" />);
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  });

  it('denied → Access denied', () => {
    render(<CollabSyncIndicator status="denied" />);
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });

  it('synced + неотправленные правки → Syncing… после задержки (не сразу)', () => {
    vi.useFakeTimers();
    render(<CollabSyncIndicator status="synced" hasUnsyncedChanges />);

    // До задержки не мигаем.
    expect(screen.queryByText('Syncing…')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText('Syncing…')).toBeInTheDocument();
  });

  it('быстрое подтверждение до задержки → Syncing… не показывается', () => {
    vi.useFakeTimers();
    const { rerender } = render(<CollabSyncIndicator status="synced" hasUnsyncedChanges />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Правка подтверждена раньше задержки.
    rerender(<CollabSyncIndicator status="synced" hasUnsyncedChanges={false} />);
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.queryByText('Syncing…')).not.toBeInTheDocument();
  });
});
