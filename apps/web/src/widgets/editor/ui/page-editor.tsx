'use client';

import '@blocknote/mantine/style.css';

import type { PartialBlock } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import Link from 'next/link';

import type { Page } from '@/src/entities/page';
import { ErrorBoundary } from '@/src/shared/ui/error-boundary';
import { usePageAutosave } from '../model/use-page-autosave';
import { AutosaveIndicator } from './autosave-indicator';

type PageEditorProps = {
  pageId: string;
  content: Page['content'];
};

function EditorErrorFallback() {
  return (
    <div className="space-y-2">
      <p className="text-body text-muted-foreground">Не удалось открыть редактор.</p>
      <Link href="/app" className="text-body text-primary hover:underline">
        На главную
      </Link>
    </div>
  );
}

// Без `initialContent` BlockNote сам создаёт документ с одним пустым
// блоком — поэтому для новой страницы (`content` пуст) его не передаём.
function PageEditorContent({ pageId, content }: PageEditorProps) {
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

export function PageEditor(props: PageEditorProps) {
  return (
    <ErrorBoundary fallback={<EditorErrorFallback />}>
      <PageEditorContent {...props} />
    </ErrorBoundary>
  );
}
