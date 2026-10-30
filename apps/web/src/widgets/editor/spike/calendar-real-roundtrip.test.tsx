// @vitest-environment jsdom
import { EventEmitter } from 'node:events';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@/src/entities/page';
import type * as BlockNoteReact from '@blocknote/react';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  bindings: vi.fn(),
  providers: [] as unknown[],
  document: [{ type: 'paragraph' }, { type: 'calendar', props: {} }] as Page['content'],
}));
vi.mock('@/src/shared/api/client', () => ({
  apiBaseUrl: 'http://localhost:3000/api',
  apiClient: { pages: { get: mocks.get, update: mocks.update } },
}));
vi.mock('@blocknote/react', async (original) => ({
  ...(await original<typeof BlockNoteReact>()),
  useCreateBlockNote: (options: unknown) => {
    mocks.bindings(options);
    return {
      document: mocks.document,
      insertBlocks: vi.fn(),
    };
  },
}));
vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: ({ editable }: { editable: boolean }) => (
    <div data-testid="binding" data-editable={editable} />
  ),
}));
vi.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: class extends EventEmitter {
    awareness = null;
    destroy = vi.fn();
    constructor(public options: { document: unknown; token: string; url: string }) {
      super();
      mocks.providers.push(this);
    }
  },
}));

import { QueryProvider } from '@/src/shared/api';
import { RealFixture, RealCollabSession } from './calendar-real-roundtrip';

const fixture: Page = {
  id: '00000000-0000-4000-8000-000000000133',
  projectId: 'actual-get-project',
  parentId: null,
  title: 'CALENDAR-SPIKE-133 REST',
  content: [],
  position: 0,
  editorMode: 'rest',
  currentUserRole: 'owner',
  createdAt: '2026-10-30T00:00:00Z',
  updatedAt: '2026-10-30T00:00:00Z',
};
type Provider = EventEmitter & {
  options: { document: unknown; token: string; url: string };
  destroy: ReturnType<typeof vi.fn>;
};
afterEach(() => {
  vi.clearAllMocks();
  mocks.providers.length = 0;
  mocks.document = [{ type: 'paragraph' }, { type: 'calendar', props: {} }];
});

describe('real transport harness wiring (mock HTTP/provider, not server persistence)', () => {
  it('keeps a real GET viewer role readonly even after disposable confirmation', async () => {
    mocks.get.mockResolvedValue({
      status: 200,
      body: { page: { ...fixture, currentUserRole: 'viewer' } },
    });
    render(
      <QueryProvider>
        <RealFixture id={fixture.id} kind="REST" />
      </QueryProvider>,
    );
    const arm = await screen.findByRole('button', { name: /Enable disposable REST/ });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(arm).toBeDisabled();
    expect(screen.getByTestId('binding')).toHaveAttribute('data-editable', 'false');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does no PATCH or WS on load; requires confirmation, PATCH then independent no-store GET', async () => {
    let stored = fixture;
    mocks.get.mockImplementation(() => ({ status: 200, body: { page: stored } }));
    mocks.update.mockImplementation(({ body }: { body: { content: Page['content'] } }) => {
      stored = { ...stored, content: body.content };
      return { status: 200, body: { page: stored } };
    });
    render(
      <QueryProvider>
        <RealFixture id={fixture.id} kind="REST" />
      </QueryProvider>,
    );
    const arm = await screen.findByRole('button', { name: /Enable disposable REST/ });
    expect(arm).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.providers).toHaveLength(0);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(arm);
    const save = await screen.findByRole('button', { name: /PATCH current REST/ });
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(save);
    await screen.findByText(/independent GET content match: true/);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.get.mock.calls.at(-1)?.[0]).toEqual({
      params: { pageId: fixture.id },
      fetchOptions: { cache: 'no-store' },
    });
    expect(mocks.get.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      mocks.update.mock.invocationCallOrder[0],
    );
  });

  it.each([
    { transport: 'JSON serialization only', equivalent: true },
    { transport: 'JSONB object key reordering', equivalent: true },
    {
      transport: 'calendar content undefined omitted by JSON then JSONB key reordering',
      equivalent: true,
    },
    { transport: 'changed nested prop value', equivalent: false },
    { transport: 'reordered block sequence', equivalent: false },
  ])('reports semantic content match after $transport', async ({ transport, equivalent }) => {
    const submitted: Page['content'] = [
      {
        type: 'paragraph',
        id: 'paragraph-133',
        props: { backgroundColor: 'default', textAlignment: 'left', textColor: 'default' },
        content: [
          { type: 'text', text: 'Transport fixture', styles: { italic: true, bold: true } },
          { type: 'text', text: ' stays ordered', styles: {} },
        ],
        children: [],
      },
      { type: 'calendar', id: 'calendar-133', props: {}, children: [] },
    ];
    // JSONB не сохраняет порядок ключей объектов. Явный образ ответа, не компаратор:
    // меняем порядок на каждом уровне объектов, но не значения и не порядок массивов.
    const jsonbContent: Array<Record<string, unknown>> = [
      {
        id: 'paragraph-133',
        type: 'paragraph',
        props: { textColor: 'default', textAlignment: 'left', backgroundColor: 'default' },
        content: [
          { text: 'Transport fixture', type: 'text', styles: { bold: true, italic: true } },
          { text: ' stays ordered', type: 'text', styles: {} },
        ],
        children: [],
      },
      { id: 'calendar-133', type: 'calendar', props: {}, children: [] },
    ];
    expect(jsonbContent).toStrictEqual(submitted);
    expect(JSON.stringify(jsonbContent)).not.toBe(JSON.stringify(submitted));
    const omitsUndefined =
      transport === 'calendar content undefined omitted by JSON then JSONB key reordering';
    if (omitsUndefined) {
      // nodeToBlock для content: 'none' создаёт перечислимое content: undefined.
      submitted[1] = {
        type: 'calendar',
        id: 'calendar-133',
        props: {},
        content: undefined,
        children: [],
      };
      expect(Object.getOwnPropertyDescriptor(submitted[1], 'content')).toMatchObject({
        value: undefined,
        enumerable: true,
      });
    }
    const wireSubmitted = JSON.parse(JSON.stringify(submitted)) as Page['content'];
    if (transport === 'changed nested prop value') {
      jsonbContent[0] = {
        ...jsonbContent[0],
        props: { textColor: 'red', textAlignment: 'left', backgroundColor: 'default' },
      };
    }
    if (transport === 'reordered block sequence') jsonbContent.reverse();
    const returnedContent = transport === 'JSON serialization only' ? submitted : jsonbContent;
    if (equivalent) expect(returnedContent).toStrictEqual(wireSubmitted);
    else expect(returnedContent).not.toStrictEqual(wireSubmitted);

    mocks.document = submitted;
    const beforeSave = JSON.stringify(submitted);
    const originalDocument = structuredClone(submitted);
    let stored = fixture;
    // Каждый GET — новый JSON-объект, как после HTTP; PATCH не возвращает ссылку редактора.
    mocks.get.mockImplementation(() => {
      const response = JSON.parse(JSON.stringify({ status: 200, body: { page: stored } })) as {
        status: 200;
        body: { page: Page };
      };
      if (omitsUndefined && response.body.page.content.length) {
        expect(response.body.page.content[1]).not.toHaveProperty('content');
        expect(response.body.page.content).toStrictEqual(wireSubmitted);
      }
      return response;
    });
    mocks.update.mockImplementation(({ body }: { body: { content: Page['content'] } }) => {
      const request = JSON.parse(JSON.stringify(body)) as { content: Page['content'] };
      expect(request.content).toStrictEqual(wireSubmitted);
      expect(request.content).not.toBe(submitted);
      expect(request.content[0]).not.toBe(submitted[0]);
      stored = { ...fixture, content: returnedContent };
      // Ответ PATCH намеренно отличается от последующего GET в отрицательных контролях.
      return JSON.parse(
        JSON.stringify({ status: 200, body: { page: { ...fixture, content: request.content } } }),
      ) as { status: 200; body: { page: Page } };
    });
    render(
      <QueryProvider>
        <RealFixture id={fixture.id} kind="REST" />
      </QueryProvider>,
    );
    await screen.findByRole('button', { name: /Enable disposable REST/ });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Enable disposable REST/ }));
    fireEvent.click(await screen.findByRole('button', { name: /PATCH current REST/ }));
    await screen.findByText(/PATCH completed; independent GET content match:/);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.get.mock.calls.at(-1)?.[0]).toEqual({
      params: { pageId: fixture.id },
      fetchOptions: { cache: 'no-store' },
    });
    expect(mocks.get.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      mocks.update.mock.invocationCallOrder[0],
    );
    expect(JSON.stringify(submitted)).toBe(beforeSave);
    expect(submitted).toStrictEqual(originalDocument);
    expect(screen.getByText(/PATCH completed; independent GET content match:/)).toHaveTextContent(
      `PATCH completed; independent GET content match: ${equivalent}; mode: rest`,
    );
  });

  it('rejects a changed fixture marker on fresh GET before any write', async () => {
    mocks.get
      .mockResolvedValueOnce({ status: 200, body: { page: fixture } })
      .mockResolvedValue({ status: 200, body: { page: { ...fixture, title: 'Real work' } } });
    render(
      <QueryProvider>
        <RealFixture id={fixture.id} kind="REST" />
      </QueryProvider>,
    );
    await screen.findByRole('button', { name: /Enable disposable REST/ });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Enable disposable REST/ }));
    await screen.findByText(/Fixture title must equal/);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.providers).toHaveLength(0);
  });

  it('refuses promotion of a populated REST fixture even after operator confirmation', async () => {
    mocks.get.mockResolvedValue({
      status: 200,
      body: {
        page: { ...fixture, title: 'CALENDAR-SPIKE-133 COLLAB', content: [{ type: 'paragraph' }] },
      },
    });
    render(
      <QueryProvider>
        <RealFixture id={fixture.id} kind="COLLAB" />
      </QueryProvider>,
    );
    await screen.findByRole('button', { name: /Connect \/ reopen/ });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Connect \/ reopen/ }));
    await screen.findByText(/Connect only to an empty REST fixture/);
    expect(mocks.providers).toHaveLength(0);
  });

  it('does not create BlockNote before sync; viewer stays readonly; reopen creates a fresh Y.Doc and cleans listeners', async () => {
    const page = {
      ...fixture,
      title: 'CALENDAR-SPIKE-133 COLLAB',
      editorMode: 'collab' as const,
      currentUserRole: 'viewer' as const,
    };
    const first = render(<RealCollabSession page={page} onClose={vi.fn()} />);
    const provider = mocks.providers[0] as Provider;
    expect(provider.options.token).toBe('cookie-auth');
    expect(provider.options.url).toMatch(/\/collab$/);
    expect(mocks.bindings).not.toHaveBeenCalled();
    act(() => {
      provider.emit('status', { status: 'connected' });
      provider.emit('synced', { state: false });
    });
    expect(mocks.bindings).not.toHaveBeenCalled();
    act(() => {
      provider.emit('synced', { state: true });
    });
    await waitFor(() =>
      expect(screen.getByTestId('binding')).toHaveAttribute('data-editable', 'false'),
    );
    act(() => {
      provider.emit('unsyncedChanges', 1);
    });
    expect(screen.getByRole('button', { name: /Disconnect/ })).toBeDisabled();
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    first.unmount();
    expect(provider.destroy).toHaveBeenCalledOnce();
    expect(provider.eventNames()).toEqual([]);
    render(<RealCollabSession page={page} onClose={vi.fn()} />);
    expect((mocks.providers[1] as Provider).options.document).not.toBe(provider.options.document);
  });

  it('enables an editor only after sync and disables edits after disconnect/auth failure', async () => {
    render(
      <RealCollabSession
        page={{ ...fixture, editorMode: 'collab', currentUserRole: 'editor' }}
        onClose={vi.fn()}
      />,
    );
    const provider = mocks.providers[0] as Provider;
    expect(screen.queryByTestId('binding')).not.toBeInTheDocument();
    act(() => {
      provider.emit('status', { status: 'connected' });
      provider.emit('synced', { state: true });
    });
    await waitFor(() =>
      expect(screen.getByTestId('binding')).toHaveAttribute('data-editable', 'true'),
    );
    act(() => {
      provider.emit('status', { status: 'disconnected' });
    });
    expect(screen.getByTestId('binding')).toHaveAttribute('data-editable', 'false');
    act(() => {
      provider.emit('authenticationFailed');
    });
    expect(screen.queryByTestId('binding')).not.toBeInTheDocument();
  });
});
