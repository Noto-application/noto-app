// @vitest-environment jsdom
import type { EventEmitter } from 'node:events';

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { providers } = vi.hoisted(() => ({ providers: [] as EventEmitter[] }));

vi.mock('@hocuspocus/provider', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    HocuspocusProvider: class extends EventEmitter {
      awareness = null;

      constructor() {
        super();
        providers.push(this);
      }

      // Очистку подписок проверяем отдельно от уничтожения провайдера.
      destroy() {}
    },
  };
});

vi.mock('@blocknote/core/yjs', () => ({ withCollaboration: vi.fn() }));
vi.mock('@blocknote/react', () => ({ useCreateBlockNote: () => ({}) }));
vi.mock('@blocknote/mantine', () => ({ BlockNoteView: () => null }));
vi.mock('@/src/entities/user', () => ({ useCurrentUser: () => ({ data: undefined }) }));

import { CollabEditorClient } from './collab-editor-client';

afterEach(() => {
  cleanup();
  providers.length = 0;
});

function attemptUnload() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function renderSyncedEditor() {
  const view = render(<CollabEditorClient pageId="00000000-0000-4000-8000-000000000001" />);
  const provider = providers[0];
  act(() => {
    provider.emit('status', { status: 'connected' });
    provider.emit('synced', { state: true });
    provider.emit('unsyncedChanges', 0);
  });
  expect(screen.queryByRole('status', { name: 'Collaboration connection' })).not.toBeInTheDocument();
  return { ...view, provider };
}

describe('CollabEditorClient: предупреждение при закрытии вкладки', () => {
  it('предупреждает о неподтверждённой правке после синка и снимает предупреждение после подтверждения', () => {
    const { provider } = renderSyncedEditor();
    expect(attemptUnload()).toBe(false);

    act(() => {
      provider.emit('unsyncedChanges', 1);
    });
    // Соединение остаётся исправным: статус не заменяет подтверждение правки.
    expect(screen.queryByRole('status', { name: 'Collaboration connection' })).not.toBeInTheDocument();
    expect(attemptUnload()).toBe(true);

    act(() => {
      provider.emit('unsyncedChanges', 0);
    });
    expect(attemptUnload()).toBe(false);
  });

  it('снимает активное предупреждение и подписки провайдера при размонтировании', () => {
    const { provider, unmount } = renderSyncedEditor();
    act(() => {
      provider.emit('unsyncedChanges', 1);
    });
    expect(attemptUnload()).toBe(true);

    unmount();

    expect(attemptUnload()).toBe(false);
    expect(provider.eventNames()).toEqual([]);
  });
});
