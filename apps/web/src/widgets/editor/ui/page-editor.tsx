'use client';

import '@blocknote/mantine/style.css';

import type { PartialBlock } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';

import type { Page } from '@/src/entities/page';
import { usePageAutosave } from '../model/use-page-autosave';
import { AutosaveIndicator } from './autosave-indicator';

type PageEditorProps = {
  pageId: string;
  content: Page['content'];
};

// Без `initialContent` BlockNote сам создаёт документ с одним пустым
// блоком — поэтому для новой страницы (`content` пуст) его не передаём.
export function PageEditor({ pageId, content }: PageEditorProps) {
  const { onChange, status, retry } = usePageAutosave(pageId);
  const editor = useCreateBlockNote({
    initialContent: content.length > 0 ? (content as PartialBlock[]) : undefined,
  });

  return (
    <>
      <AutosaveIndicator status={status} onRetry={retry} />
      <BlockNoteView editor={editor} onChange={() => onChange(editor.document)} />
    </>
  );
}
