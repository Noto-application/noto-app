'use client';

import { withCollaboration } from '@blocknote/core/yjs';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { replaceEqualDeep, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';

import { pageKeys, updatePage, usePage, type Page } from '@/src/entities/page';
import { apiBaseUrl, apiClient, QueryProvider, toApiClientError } from '@/src/shared/api';
import { ErrorBoundary } from '@/src/shared/ui/error-boundary';
import { buildCollabUrl } from '../lib/collab-url';
import { toSyncStatus, type CollabSyncStatus } from '../model/collab-sync-status';
import { CalendarSpikeContext, calendarSpikeSchema } from './calendar-schema';

type Kind = 'REST' | 'COLLAB';
type SpikeDocument = (typeof calendarSpikeSchema.PartialBlock)[];
const marker = (kind: Kind) => `CALENDAR-SPIKE-133 ${kind}`;
const canWrite = (page: Page) =>
  page.currentUserRole === 'owner' || page.currentUserRole === 'editor';

// Независимый сетевой GET, не Query refetch/cache и не ответ PATCH.
async function freshPage(id: string): Promise<Page> {
  const result = await apiClient.pages.get({
    params: { pageId: id },
    fetchOptions: { cache: 'no-store' },
  });
  if (result.status !== 200) throw toApiClientError(result.body);
  return result.body.page;
}

function validateFixture(page: Page, kind: Kind) {
  if (page.title !== marker(kind)) throw new Error(`Fixture title must equal ${marker(kind)}`);
  if (kind === 'REST' && page.editorMode !== 'rest')
    throw new Error('REST fixture must remain in rest mode.');
  if (
    kind === 'COLLAB' &&
    page.editorMode !== 'collab' &&
    !(page.editorMode === 'rest' && page.content.length === 0 && canWrite(page))
  ) {
    throw new Error(
      'Connect only to an empty REST fixture (editor+) or an existing collab fixture.',
    );
  }
}

function RealRestEditor({
  page,
  editable,
  onSave,
}: {
  page: Page;
  editable: boolean;
  onSave?: (content: Page['content']) => Promise<void>;
}) {
  const editor = useCreateBlockNote({
    schema: calendarSpikeSchema,
    initialContent: page.content.length ? (page.content as SpikeDocument) : undefined,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      {editable && (
        <>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              editor.insertBlocks(
                [
                  { type: 'paragraph', content: 'Disposable calendar transport fixture' },
                  { type: 'calendar' },
                  { type: 'calendar' },
                ],
                editor.document[0],
                'after',
              )
            }
          >
            Insert diagnostic blocks locally (not saved)
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              setError('');
              void onSave?.(editor.document)
                .catch((err: unknown) => setError(String(err)))
                .finally(() => setSaving(false));
            }}
          >
            PATCH current REST document → independent GET → remount
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <BlockNoteView editor={editor} editable={editable && !saving} slashMenu={false} />
    </>
  );
}

function SyncedBinding({
  doc,
  provider,
  page,
  editable,
}: {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  page: Page;
  editable: boolean;
}) {
  const editor = useCreateBlockNote(
    withCollaboration({
      schema: calendarSpikeSchema,
      collaboration: {
        fragment: doc.getXmlFragment('document-store'),
        provider: { awareness: provider.awareness ?? undefined },
        user: { name: 'Disposable spike operator', color: '#2563eb' },
      },
    }),
    [doc, provider],
  );
  return (
    <>
      <p>Server role: {page.currentUserRole}. No REST autosave in this binding.</p>
      <button
        type="button"
        disabled={!editable}
        onClick={() =>
          editor.insertBlocks(
            [
              { type: 'paragraph', content: 'Disposable Yjs calendar transport fixture' },
              { type: 'calendar' },
              { type: 'calendar' },
            ],
            editor.document[0],
            'after',
          )
        }
      >
        Insert diagnostic blocks into synced Yjs
      </button>
      <BlockNoteView editor={editor} editable={editable} slashMenu={false} />
    </>
  );
}

// Компонент монтируется только явным Connect. Каждый новый монтаж — новый provider + Y.Doc.
export function RealCollabSession({ page, onClose }: { page: Page; onClose: () => void }) {
  const [connection, setConnection] = useState<{ doc: Y.Doc; provider: HocuspocusProvider }>();
  const [status, setStatus] = useState<CollabSyncStatus>('connecting');
  const [syncedOnce, setSyncedOnce] = useState(false);
  const [pending, setPending] = useState(0);
  const [updates, setUpdates] = useState(0);
  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: buildCollabUrl(window.location.origin),
      name: page.id,
      document: doc,
      token: 'cookie-auth',
    });
    let synced = false;
    let network = 'connecting';
    let authFailed = false;
    const refresh = () => setStatus(toSyncStatus({ synced, status: network, authFailed }));
    const onStatus = ({ status: value }: { status: string }) => {
      network = value;
      refresh();
    };
    const onSynced = ({ state }: { state: boolean }) => {
      synced = state;
      if (state) setSyncedOnce(true);
      refresh();
    };
    const onDenied = () => {
      authFailed = true;
      refresh();
    };
    const onPending = (count: number) => setPending(count);
    const onUpdate = () => setUpdates((n) => n + 1);
    provider.on('status', onStatus);
    provider.on('synced', onSynced);
    provider.on('authenticationFailed', onDenied);
    provider.on('unsyncedChanges', onPending);
    doc.on('update', onUpdate);
    // Ресурсы и cleanup симметричны, включая Strict Mode.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnection({ doc, provider });
    return () => {
      provider.off('status', onStatus);
      provider.off('synced', onSynced);
      provider.off('authenticationFailed', onDenied);
      provider.off('unsyncedChanges', onPending);
      doc.off('update', onUpdate);
      provider.destroy();
      doc.destroy();
    };
  }, [page.id]);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);
  return (
    <>
      <p role="status">
        WS: {status}; unacknowledged changes: {pending}; Yjs updates: {updates}
      </p>
      <p>
        Synced / acknowledged does NOT prove database durability. Reopen uses a new Y.Doc; server
        restart needs separate approval.
      </p>
      <button type="button" disabled={pending > 0} onClick={onClose}>
        Disconnect (then explicitly reopen)
      </button>
      {connection && syncedOnce && status !== 'denied' && (
        <SyncedBinding
          {...connection}
          page={page}
          editable={status === 'synced' && canWrite(page)}
        />
      )}
    </>
  );
}

export function RealFixture({ id, kind }: { id: string; kind: Kind }) {
  const query = usePage(id);
  const cache = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState('');
  const page = query.data;

  async function inspect() {
    const fresh = await freshPage(id);
    validateFixture(fresh, kind);
    if (fresh.id !== id) throw new Error('Unexpected page response.');
    if (page && fresh.projectId !== page.projectId)
      throw new Error('Containing project changed; reload fixture.');
    cache.setQueryData(pageKeys.detail(id), fresh);
    return fresh;
  }
  function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    void action()
      .catch((err: unknown) => setMessage(String(err)))
      .finally(() => setBusy(false));
  }
  if (query.isPending) return <p>Loading {kind} fixture…</p>;
  if (query.error || !page)
    return (
      <p role="alert">
        Cannot load {kind} fixture: {String(query.error ?? 'not found')}
      </p>
    );
  if (page.title !== marker(kind))
    return <p role="alert">Refused: title must equal {marker(kind)}.</p>;

  return (
    <section className="space-y-2 border p-4">
      <h3>Real {kind} fixture</h3>
      <p>
        ID: {page.id}; containing project (GET): {page.projectId}; editorMode: {page.editorMode};
        role: {page.currentUserRole}
      </p>
      <p>Only disposable fixture data. Do not open this Page in the production editor.</p>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={armed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I confirm this ID is disposable and explicitly authorize{' '}
        {kind === 'REST' ? 'REST writes' : 'WS connection / empty REST → collab promotion'}.
      </label>
      <p role="status">{message}</p>
      <CalendarSpikeContext.Provider
        value={{
          page: { projectId: page.projectId },
          items: [
            {
              id: 'synthetic-real-transport',
              date: '2026-03-08',
              label: 'SYNTHETIC transport card — not calendar API',
            },
          ],
        }}
      >
        {kind === 'REST' && page.editorMode === 'rest' && (
          <>
            <h4>Readonly REST GET snapshot</h4>
            <RealRestEditor key={`reader-${generation}`} page={page} editable={false} />
            <button
              type="button"
              disabled={busy || armed}
              onClick={() =>
                run(async () => {
                  await inspect();
                  setGeneration((n) => n + 1);
                  setMessage('Independent no-store GET; readers remounted.');
                })
              }
            >
              Independent GET → remount readonly
            </button>
          </>
        )}
        {!armed && (
          <button
            type="button"
            disabled={busy || !confirmed || (kind === 'REST' && !canWrite(page))}
            onClick={() =>
              run(async () => {
                const fresh = await inspect();
                if (kind === 'REST' && !canWrite(fresh))
                  throw new Error('Server role does not allow REST writes.');
                setArmed(true);
              })
            }
          >
            {kind === 'REST'
              ? 'Enable disposable REST editor (no automatic save)'
              : 'Connect / reopen WS (may promote EMPTY REST fixture)'}
          </button>
        )}
        {armed && kind === 'REST' && canWrite(page) && page.editorMode === 'rest' && (
          <>
            <h4>Editable REST document — manual save only</h4>
            <RealRestEditor
              key={`writer-${generation}`}
              page={page}
              editable={!busy}
              onSave={async (content) => {
                setBusy(true);
                try {
                  const snapshot = JSON.parse(JSON.stringify(content)) as Page['content'];
                  const fresh = await inspect();
                  if (!canWrite(fresh))
                    throw new Error('Server role no longer allows REST writes.');
                  await updatePage(id, { content: snapshot });
                  const reopened = await inspect();
                  setGeneration((n) => n + 1);
                  setMessage(
                    `PATCH completed; independent GET content match: ${replaceEqualDeep(snapshot, reopened.content) === snapshot}; mode: ${reopened.editorMode}`,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setArmed(false);
                setConfirmed(false);
              }}
            >
              Disable REST editor (discard unsaved local changes)
            </button>
          </>
        )}
        {armed && kind === 'COLLAB' && (
          <RealCollabSession
            page={page}
            onClose={() => {
              setArmed(false);
              setConfirmed(false);
            }}
          />
        )}
      </CalendarSpikeContext.Provider>
    </section>
  );
}

function RealFixtures() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const restId = params.get('restPageId') ?? '';
  const collabId = params.get('collabPageId') ?? '';
  const valid = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (new URL(apiBaseUrl, window.location.origin).origin !== window.location.origin) {
    return (
      <p role="alert">
        Real transport requires API and /collab on the same origin. Open the approved localhost:8080
        environment; do not bypass cookies/CORS.
      </p>
    );
  }
  return (
    <section className="space-y-4">
      <h2>Opt-in REAL disposable Page transport (not calendar API)</h2>
      <form
        key={`${restId}-${collabId}`}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next = new URLSearchParams(params);
          for (const key of ['restPageId', 'collabPageId']) {
            const value = data.get(key);
            next.set(key, typeof value === 'string' ? value.trim() : '');
          }
          router.push(`${pathname}?${next}`, { scroll: false });
        }}
      >
        <label>
          REST disposable Page ID <input name="restPageId" defaultValue={restId} />
        </label>{' '}
        <label>
          COLLAB disposable Page ID (different!){' '}
          <input name="collabPageId" defaultValue={collabId} />
        </label>{' '}
        <button type="submit">Select fixture IDs in URL (GET only)</button>
      </form>
      {restId && restId === collabId ? (
        <p role="alert">Separate REST and COLLAB fixtures are required.</p>
      ) : (
        <>
          {valid(restId) && <RealFixture key={`rest-${restId}`} id={restId} kind="REST" />}
          {valid(collabId) && (
            <RealFixture key={`collab-${collabId}`} id={collabId} kind="COLLAB" />
          )}
        </>
      )}
    </section>
  );
}

export function CalendarRealRoundtrip() {
  return (
    <ErrorBoundary
      fallback={
        <p role="alert">
          Real fixture could not be rendered. Stop and inspect the disposable Page; no automatic
          recovery write.
        </p>
      }
    >
      <QueryProvider>
        <RealFixtures />
      </QueryProvider>
    </ErrorBoundary>
  );
}
