// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Page } from '@/src/entities/page';

type BlockNoteViewStubProps = { onChange?: () => void };

const { useCreateBlockNote, blockNoteViewProps, autosaveOnChange, autosaveRetry, autosaveState, DOCUMENT_STUB } =
  vi.hoisted(() => {
    const DOCUMENT_STUB = [{ type: 'paragraph', content: 'текущий документ редактора' }];

    return {
      DOCUMENT_STUB,
      useCreateBlockNote: vi.fn(() => ({ document: DOCUMENT_STUB })),
      blockNoteViewProps: vi.fn<(props: BlockNoteViewStubProps) => void>(),
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
  usePageAutosave: () => ({ onChange: autosaveOnChange, status: autosaveState.status, retry: autosaveRetry }),
}));

import { PageEditor } from './page-editor';

const pageId = '00000000-0000-4000-8000-000000000001';

afterEach(() => {
  vi.clearAllMocks();
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

  it('передаёт status и retry из usePageAutosave в AutosaveIndicator', async () => {
    autosaveState.status = 'error';
    const user = userEvent.setup();
    render(<PageEditor pageId={pageId} content={[]} />);

    expect(screen.getByText('Не удалось сохранить')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(autosaveRetry).toHaveBeenCalledTimes(1);
  });
});
