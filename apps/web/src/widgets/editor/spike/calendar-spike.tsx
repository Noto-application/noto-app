'use client';

import '@blocknote/mantine/style.css';

import type { PartialBlock } from '@blocknote/core';
import { withCollaboration } from '@blocknote/core/yjs';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as Y from 'yjs';

import { MonthGrid, type MonthGridRange } from '@/src/shared/ui/calendar/month-grid';
import { CalendarSpikeContext, calendarSpikeSchema, MonthControls } from './calendar-schema';
import { CalendarRealRoundtrip } from './calendar-real-roundtrip';

const source = {
  page: { projectId: 'synthetic-project-a' },
  items: [
    { id: 'fixture-adjacent-before', date: '2026-02-23', label: 'SYNTHETIC A · adjacent February' },
    { id: 'fixture-dst', date: '2026-03-08', label: 'SYNTHETIC A · US DST' },
    { id: 'fixture-eu-dst', date: '2026-03-29', label: 'SYNTHETIC A · EU DST · long card title' },
    { id: 'fixture-adjacent-after', date: '2026-04-05', label: 'SYNTHETIC A · adjacent April' },
  ],
};
const destination = {
  page: { projectId: 'synthetic-project-b' },
  items: [{ id: 'fixture-b', date: '2026-03-08', label: 'SYNTHETIC B · destination only' }],
};
const initialContent: PartialBlock<typeof calendarSpikeSchema.blockSchema>[] = [
  { type: 'paragraph' },
  { type: 'calendar' },
  { type: 'calendar' },
];
type SpikeDocument = (typeof calendarSpikeSchema.PartialBlock)[];

function JsonEditor({
  content,
  readonly = false,
  onSnapshot,
  theme,
}: {
  content: SpikeDocument;
  readonly?: boolean;
  onSnapshot?: (content: SpikeDocument) => void;
  theme: 'light' | 'dark';
}) {
  const editor = useCreateBlockNote({ schema: calendarSpikeSchema, initialContent: content });
  const [exports, setExports] = useState('');
  const [changes, setChanges] = useState(0);
  return (
    <>
      <p>Document changes: {changes}</p>
      {onSnapshot && (
        <button
          type="button"
          onClick={() => onSnapshot(JSON.parse(JSON.stringify(editor.document)) as SpikeDocument)}
        >
          JSON serialize → remount viewers
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          const html = editor.blocksToHTMLLossy();
          const markdown = editor.blocksToMarkdownLossy();
          setExports(JSON.stringify({ html, markdown }, null, 2));
        }}
      >
        Inspect external HTML / Markdown
      </button>
      <pre className="overflow-auto whitespace-pre-wrap">{exports}</pre>
      <BlockNoteView
        editor={editor}
        theme={theme}
        editable={!readonly}
        slashMenu={false}
        onChange={() => setChanges((n) => n + 1)}
      />
    </>
  );
}

function BoundYjsEditor({ doc, theme }: { doc: Y.Doc; theme: 'light' | 'dark' }) {
  const editor = useCreateBlockNote(
    withCollaboration({
      schema: calendarSpikeSchema,
      collaboration: {
        fragment: doc.getXmlFragment('document-store'),
        user: { name: 'Synthetic', color: '#2563eb' },
      },
    }),
    [doc],
  );
  return (
    <>
      <button
        type="button"
        onClick={() => editor.insertBlocks(initialContent, editor.document[0], 'after')}
      >
        Insert two calendar blocks into Yjs
      </button>
      <BlockNoteView editor={editor} theme={theme} slashMenu={false} />
    </>
  );
}

function YjsFixture({ theme }: { theme: 'light' | 'dark' }) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [updates, setUpdates] = useState(0);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const next = new Y.Doc();
    const update = () => setUpdates((n) => n + 1);
    next.on('update', update);
    // Ресурс создаётся симметрично cleanup, как в production collab-editor-client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDoc(next);
    return () => {
      next.off('update', update);
      next.destroy();
    };
  }, []);
  return (
    <section>
      <h2>Local Yjs binding — no server or database</h2>
      <p>Yjs updates: {updates}. Month navigation must not increment this counter.</p>
      <button type="button" onClick={() => setGeneration((n) => n + 1)}>
        Remount binding (same Y.Doc)
      </button>
      {doc && <BoundYjsEditor key={generation} doc={doc} theme={theme} />}
    </section>
  );
}

export function CalendarSpike() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const month = params.get('month') ?? '2026-03';
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && !month.startsWith('0000');
  const [range, setRange] = useState<MonthGridRange>();
  const [action, setAction] = useState('');
  const [dark, setDark] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [destinationReadonly, setDestinationReadonly] = useState(true);
  const [snapshot, setSnapshot] = useState({ content: initialContent, generation: 0 });
  const navigate = useCallback(
    (next: string) => {
      const query = new URLSearchParams(params);
      query.set('month', next);
      router.push(`${pathname}?${query}`, { scroll: false });
    },
    [params, pathname, router],
  );
  return (
    <main className={`${dark ? 'dark' : ''} min-h-screen bg-background p-4 text-foreground`}>
      <h1>Calendar integration spike #133 — SYNTHETIC fixtures only</h1>
      <p>
        Local SYNTHETIC fixtures below do not call APIs. Optional real disposable Page transport is
        explicitly gated in its own section. No production slash menu. Copy/paste is not a trusted
        boundary.
      </p>
      <label>
        <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark
        fixture
      </label>{' '}
      <label>
        <input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} />{' '}
        Narrow fixture (320px)
      </label>
      <div className="space-y-8" style={{ width: narrow ? 320 : '100%', maxWidth: '100%' }}>
        <section>
          <h2>URL-controlled month (browser back / forward)</h2>
          {validMonth ? (
            <>
              <MonthControls month={month} onChange={navigate} />
              <p>Visible exclusive range: {range ? `[${range.from}, ${range.to})` : 'pending'}</p>
              <p aria-live="polite">{action}</p>
              <MonthGrid
                month={month}
                items={source.items}
                onRangeChange={setRange}
                onDateClick={(date) => setAction(`Synthetic dateClick: ${date}`)}
                onItemClick={(id) => setAction(`Synthetic card: ${id}`)}
              />
            </>
          ) : (
            <p>Invalid fixture month; no calendar mounted.</p>
          )}
        </section>
        <CalendarSpikeContext.Provider value={source}>
          <section>
            <h2>JSON editable · two independent blocks · synthetic containing Page A</h2>
            <JsonEditor
              theme={dark ? 'dark' : 'light'}
              content={initialContent}
              onSnapshot={(content) =>
                setSnapshot((s) => ({ content, generation: s.generation + 1 }))
              }
            />
          </section>
          <YjsFixture theme={dark ? 'dark' : 'light'} />
        </CalendarSpikeContext.Provider>
        <CalendarSpikeContext.Provider value={destination}>
          <section>
            <h2>JSON destination Page B · same schema · readonly by default</h2>
            <label>
              <input
                type="checkbox"
                checked={destinationReadonly}
                onChange={(e) => setDestinationReadonly(e.target.checked)}
              />
              Destination readonly (uncheck to test paste)
            </label>
            <p>
              JSON snapshot is local transport simulation, NOT REST or real clipboard verification.
            </p>
            <JsonEditor
              theme={dark ? 'dark' : 'light'}
              key={snapshot.generation}
              content={snapshot.content}
              readonly={destinationReadonly}
            />
          </section>
        </CalendarSpikeContext.Provider>
        <section>
          <h2>Absent context · inert, no fetch</h2>
          <JsonEditor theme={dark ? 'dark' : 'light'} content={initialContent} readonly />
        </section>
        <CalendarRealRoundtrip />
      </div>
    </main>
  );
}
