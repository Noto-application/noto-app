// @vitest-environment jsdom
import { BlockNoteEditor } from '@blocknote/core';
import { blocksToYDoc, withCollaboration, yDocToBlocks } from '@blocknote/core/yjs';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { localDateOnly, MonthGrid } from '@/src/shared/ui/calendar/month-grid';
import { CalendarSpikeContext, calendarSpikeSchema } from './calendar-schema';

describe('FullCalendar 7 integration (jsdom, not browser layout)', () => {
  it('renders ru/Monday, adjacent JSX cards and the actual exclusive range, then follows external month', async () => {
    const onRangeChange = vi.fn();
    const onDateClick = vi.fn();
    const onItemClick = vi.fn();
    const items = [{ id: 'synthetic', date: '2026-02-23', label: 'SYNTHETIC adjacent card' }];
    const { container, rerender } = render(
      <MonthGrid
        month="2026-03"
        items={items}
        onRangeChange={onRangeChange}
        onDateClick={onDateClick}
        onItemClick={onItemClick}
      />,
    );
    await waitFor(() =>
      expect(onRangeChange).toHaveBeenLastCalledWith({ from: '2026-02-23', to: '2026-04-06' }),
    );
    expect(container.querySelector('[data-date="2026-02-23"]')).not.toBeNull();
    expect(container.querySelector('[data-date="2026-04-05"]')).not.toBeNull();
    expect(container.querySelector('[data-date="2026-04-06"]')).toBeNull();
    expect(screen.getByText('SYNTHETIC adjacent card')).toHaveClass('noto-month-card');
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent(/пн/i);
    fireEvent.click(screen.getByText('SYNTHETIC adjacent card'));
    expect(onItemClick).toHaveBeenCalledWith('synthetic');
    rerender(<MonthGrid month="2026-04" items={items} onRangeChange={onRangeChange} />);
    await waitFor(() =>
      expect(onRangeChange).toHaveBeenLastCalledWith({ from: '2026-03-30', to: '2026-05-04' }),
    );
  });

  it('formats local date-only on DST transition dates without UTC conversion', () => {
    expect(localDateOnly(new Date(2026, 2, 8))).toBe('2026-03-08');
    expect(localDateOnly(new Date(2026, 2, 29))).toBe('2026-03-29');
    expect(localDateOnly(new Date(2026, 10, 1))).toBe('2026-11-01');
  });
});

describe('BlockNote 0.54 calendar schema integration (no REST/server/DB)', () => {
  it('keeps two rendered block months independent without changing the bound Y.Doc or document', async () => {
    const seed = BlockNoteEditor.create({
      schema: calendarSpikeSchema,
      initialContent: [{ type: 'paragraph' }, { type: 'calendar' }, { type: 'calendar' }],
    });
    const doc = blocksToYDoc(seed, seed.document, 'document-store');
    let bound: typeof seed | undefined;
    function Binding() {
      const editor = useCreateBlockNote(
        withCollaboration({
          schema: calendarSpikeSchema,
          collaboration: {
            fragment: doc.getXmlFragment('document-store'),
            user: { name: 'Synthetic', color: '#2563eb' },
          },
        }),
      );
      bound = editor;
      return <BlockNoteView editor={editor} editable={false} slashMenu={false} />;
    }
    const { unmount } = render(
      <CalendarSpikeContext.Provider
        value={{
          page: { projectId: 'synthetic-project' },
          items: [{ id: 'private-fixture', date: '2026-03-08', label: 'PRIVATE fixture title' }],
        }}
      >
        <Binding />
      </CalendarSpikeContext.Provider>,
    );
    await waitFor(() => expect(screen.getAllByText('2026-03')).toHaveLength(2));
    await screen.findAllByText('PRIVATE fixture title');
    const clipboard = new Map<string, string>();
    expect(
      fireEvent.copy(screen.getAllByText('PRIVATE fixture title')[0], {
        clipboardData: {
          clearData: () => clipboard.clear(),
          setData: (format: string, value: string) => clipboard.set(format, value),
        },
      }),
    ).toBe(false);
    expect(clipboard.get('text/plain')).toBe('[Calendar unavailable]');
    expect(clipboard.get('text/html')).toBe('<p>[Calendar unavailable]</p>');
    expect(bound?.blocksToHTMLLossy()).not.toContain('PRIVATE fixture title');
    const state = Y.encodeStateAsUpdate(doc);
    const json = JSON.stringify(bound?.document);
    const update = vi.fn();
    doc.on('update', update);
    fireEvent.click(screen.getAllByRole('button', { name: 'Next month' })[0]);
    await waitFor(() => expect(screen.getByText('2026-04')).toBeInTheDocument());
    expect(screen.getAllByText('2026-03')).toHaveLength(1);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(state);
    expect(JSON.stringify(bound?.document)).toBe(json);
    expect(update).not.toHaveBeenCalled();
    unmount();
    doc.destroy();
  });

  it('roundtrips empty calendar props through JSON and binary Yjs with the same schema', () => {
    const editable = BlockNoteEditor.create({
      schema: calendarSpikeSchema,
      initialContent: [{ type: 'calendar' }, { type: 'calendar' }],
    });
    const json = JSON.parse(JSON.stringify(editable.document)) as typeof editable.document;
    const readonly = BlockNoteEditor.create({ schema: calendarSpikeSchema, initialContent: json });
    readonly.isEditable = false;
    expect(readonly.document).toEqual(editable.document);
    expect(json.map((block) => block.props)).toEqual([{}, {}]);
    const internalHTML = editable.blocksToFullHTML();
    expect(internalHTML).toContain('data-content-type="calendar"');
    const parsed = readonly.tryParseHTMLToBlocks(internalHTML);
    expect(parsed.map((block) => ({ type: block.type, props: block.props }))).toEqual([
      { type: 'calendar', props: {} },
      { type: 'calendar', props: {} },
    ]);

    const source = blocksToYDoc(editable, editable.document, 'document-store');
    const restored = new Y.Doc();
    Y.applyUpdate(restored, Y.encodeStateAsUpdate(source));
    expect(yDocToBlocks(readonly, restored, 'document-store')).toEqual(editable.document);
    source.destroy();
    restored.destroy();
  });

  it('uses a static external HTML/Markdown placeholder instead of rendering runtime data', () => {
    const editor = BlockNoteEditor.create({
      schema: calendarSpikeSchema,
      initialContent: [{ type: 'calendar' }],
    });
    const html = editor.blocksToHTMLLossy();
    const text = editor.blocksToMarkdownLossy();
    expect(html).toContain('[Calendar unavailable]');
    expect(text).toContain('[Calendar unavailable]');
    expect(html).not.toMatch(/synthetic-project|SYNTHETIC|2026-|fullcalendar|data-project/i);
    expect(text).not.toMatch(/synthetic-project|SYNTHETIC|2026-/i);
  });
});
