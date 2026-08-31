// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Page } from '@/src/entities/page';

type BlockNoteViewStubProps = { onChange?: () => void };

const { useCreateBlockNote, blockNoteViewProps, autosaveOnChange, DOCUMENT_STUB } = vi.hoisted(() => {
  const DOCUMENT_STUB = [{ type: 'paragraph', content: 'текущий документ редактора' }];

  return {
    DOCUMENT_STUB,
    useCreateBlockNote: vi.fn(() => ({ document: DOCUMENT_STUB })),
    blockNoteViewProps: vi.fn<(props: BlockNoteViewStubProps) => void>(),
    autosaveOnChange: vi.fn(),
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
  usePageAutosave: () => ({ onChange: autosaveOnChange }),
}));

import { PageEditor } from './page-editor';

const pageId = '00000000-0000-4000-8000-000000000001';

afterEach(() => {
  vi.clearAllMocks();
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
});
