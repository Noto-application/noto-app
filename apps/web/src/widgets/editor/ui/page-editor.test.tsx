// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Page } from '@/src/entities/page';

const useCreateBlockNote = vi.fn(() => ({ document: [] }));

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: (...args: unknown[]) => useCreateBlockNote(...args),
}));

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: () => null,
}));

vi.mock('../model/use-page-autosave', () => ({
  usePageAutosave: () => ({ onChange: vi.fn() }),
}));

const { PageEditor } = await import('./page-editor');

const pageId = '00000000-0000-4000-8000-000000000001';

describe('PageEditor', () => {
  it('передаёт content как initialContent, когда на странице уже есть блоки', () => {
    const content = [{ type: 'paragraph', content: 'сохранённый текст' }] as Page['content'];

    render(<PageEditor pageId={pageId} content={content} />);

    expect(useCreateBlockNote).toHaveBeenCalledWith(expect.objectContaining({ initialContent: content }));
  });

  it('не передаёт initialContent для новой страницы без сохранённого контента', () => {
    render(<PageEditor pageId={pageId} content={[] as Page['content']} />);

    expect(useCreateBlockNote).toHaveBeenCalledWith(expect.objectContaining({ initialContent: undefined }));
  });
});
