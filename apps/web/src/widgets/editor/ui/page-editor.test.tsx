// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Page } from '@/src/entities/page';

type BlockNoteViewStubProps = { onChange?: () => void };

const {
  useCreateBlockNote,
  blockNoteViewProps,
  usePageAutosave,
  autosaveOnChange,
  autosaveRetry,
  autosaveState,
  DOCUMENT_STUB,
} = vi.hoisted(() => {
  const DOCUMENT_STUB = [{ type: 'paragraph', content: 'текущий документ редактора' }];

  return {
    DOCUMENT_STUB,
    useCreateBlockNote: vi.fn(() => ({ document: DOCUMENT_STUB })),
    blockNoteViewProps: vi.fn<(props: BlockNoteViewStubProps) => void>(),
    usePageAutosave: vi.fn(),
    autosaveOnChange: vi.fn(),
    autosaveRetry: vi.fn(),
    autosaveState: { status: 'idle' },
  };
});

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote,
}));

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: (props: BlockNoteViewStubProps) => {
    blockNoteViewProps(props);
    return null;
  },
}));

vi.mock('../model/use-page-autosave', () => ({
  usePageAutosave,
}));

// CollabEditor — ленивый dynamic-компонент с Yjs/WS-цепочкой; здесь проверяем
// только выбор режима, поэтому подменяем его маркером.
vi.mock('./collab-editor', () => ({
  CollabEditor: ({ pageId }: { pageId: string }) => (
    <div data-testid="collab-editor" data-page-id={pageId} />
  ),
}));

import { PageEditor } from './page-editor';

const pageId = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  usePageAutosave.mockImplementation(() => ({
    onChange: autosaveOnChange,
    status: autosaveState.status,
    retry: autosaveRetry,
  }));
  // Флаг collab по умолчанию выключен, чтобы REST-тесты не зависели от env
  // прогона; collab-тесты поднимают его явно.
  vi.stubEnv('NEXT_PUBLIC_COLLAB_ENABLED', 'false');
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  autosaveState.status = 'idle';
});

describe('PageEditor', () => {
  it('передаёт content как initialContent, когда на странице уже есть блоки', () => {
    const content = [{ type: 'paragraph', content: 'сохранённый текст' }] as Page['content'];

    render(<PageEditor pageId={pageId} content={content} />);

    expect(useCreateBlockNote).toHaveBeenCalledWith({ initialContent: content });
  });

  it('не передаёт initialContent для новой страницы без сохранённого контента', () => {
    render(<PageEditor pageId={pageId} content={[] as Page['content']} />);

    expect(useCreateBlockNote).toHaveBeenCalledWith({ initialContent: undefined });
  });

  it('передаёт текущий документ редактора в usePageAutosave.onChange при изменении', () => {
    render(<PageEditor pageId={pageId} content={[]} />);

    const { onChange } = blockNoteViewProps.mock.calls.at(-1)?.[0] ?? {};
    onChange?.();

    expect(autosaveOnChange).toHaveBeenCalledWith(DOCUMENT_STUB);
  });

  it('показывает фолбэк вместо падения всего маршрута, если BlockNote бросает при рендере', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Дважды: React 19 при ошибке в конкурентном рендере молча повторяет
    // рендер синхронно — одного throw не хватит, второй пройдёт уже чисто.
    const throwOnRender = () => {
      throw new Error('невалидный content');
    };
    useCreateBlockNote.mockImplementationOnce(throwOnRender).mockImplementationOnce(throwOnRender);

    render(<PageEditor pageId={pageId} content={[]} />);

    expect(screen.getByText('Не удалось открыть редактор.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/app');
    expect(consoleError).toHaveBeenCalled();
  });

  it('передаёт status и retry из usePageAutosave в AutosaveIndicator', async () => {
    autosaveState.status = 'error';
    const user = userEvent.setup();
    render(<PageEditor pageId={pageId} content={[]} />);

    expect(screen.getByText('Не удалось сохранить')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(autosaveRetry).toHaveBeenCalledTimes(1);
  });

  // Приёмка #110: collab-режим рендерит CollabEditor и не подключает REST-автосейв.
  describe('выбор collab-режима', () => {
    it('в collab-режиме рендерит CollabEditor и не подключает REST-автосейв', () => {
      vi.stubEnv('NEXT_PUBLIC_COLLAB_ENABLED', 'true');

      render(<PageEditor pageId={pageId} content={[]} />);

      expect(screen.getByTestId('collab-editor')).toHaveAttribute('data-page-id', pageId);
      expect(usePageAutosave).not.toHaveBeenCalled();
      expect(useCreateBlockNote).not.toHaveBeenCalled();
    });

    // Durable-признак (#109): уже-collab страница открывается через Yjs даже
    // при выключенном флаге.
    it('durable collab-страница открывается в collab при выключенном флаге', () => {
      render(<PageEditor pageId={pageId} content={[]} editorMode="collab" />);

      expect(screen.getByTestId('collab-editor')).toHaveAttribute('data-page-id', pageId);
      expect(usePageAutosave).not.toHaveBeenCalled();
    });

    it('durable collab-страница с REST-контентом открывается в collab при выключенном флаге', () => {
      const content = [{ type: 'paragraph', content: 'старый REST-контент' }] as Page['content'];

      render(<PageEditor pageId={pageId} content={content} editorMode="collab" />);

      expect(screen.getByTestId('collab-editor')).toBeInTheDocument();
      expect(usePageAutosave).not.toHaveBeenCalled();
    });

    it('rest-страница с контентом остаётся на REST-редакторе при выключенном флаге', () => {
      const content = [{ type: 'paragraph', content: 'сохранённый текст' }] as Page['content'];

      render(<PageEditor pageId={pageId} content={content} editorMode="rest" />);

      expect(screen.queryByTestId('collab-editor')).not.toBeInTheDocument();
      expect(usePageAutosave).toHaveBeenCalledTimes(1);
      expect(useCreateBlockNote).toHaveBeenCalledWith({ initialContent: content });
    });
  });
});
