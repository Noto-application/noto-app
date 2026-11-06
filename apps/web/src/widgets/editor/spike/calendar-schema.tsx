'use client';

import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { createContext, lazy, Suspense, useContext, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { MonthGridItem } from '@/src/shared/ui/calendar/month-grid';

// Регистрация схемы не должна тянуть FullCalendar в документ без календарного блока.
const LazyMonthGrid = lazy(() =>
  import('@/src/shared/ui/calendar/month-grid').then((module) => ({ default: module.MonthGrid })),
);

// Контекст стенда: содержащая Page (синтетическая либо GET) и явно синтетические карточки.
export const CalendarSpikeContext = createContext<{
  page: { projectId: string };
  items: readonly MonthGridItem[];
} | null>(null);

export function MonthControls({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <button
        type="button"
        onClick={() =>
          onChange(Temporal.PlainYearMonth.from(month).subtract({ months: 1 }).toString())
        }
      >
        Previous month
      </button>
      <output aria-live="polite">{month}</output>
      <button
        type="button"
        onClick={() => onChange(Temporal.PlainYearMonth.from(month).add({ months: 1 }).toString())}
      >
        Next month
      </button>
      <button
        type="button"
        onClick={() => onChange(Temporal.Now.plainDateISO().toPlainYearMonth().toString())}
      >
        Today
      </button>
    </div>
  );
}

function CalendarBlock() {
  const context = useContext(CalendarSpikeContext);
  const [month, setMonth] = useState('2026-03');
  if (!context) return <p contentEditable={false}>[Calendar unavailable]</p>;

  return (
    <div
      contentEditable={false}
      className="w-full min-w-0"
      data-calendar-spike=""
      onCopy={(event) => {
        // BlockNote отдаёт native copy выделению внутри non-editable island: закрываем и этот путь.
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData.clearData();
        event.clipboardData.setData('text/plain', '[Calendar unavailable]');
        event.clipboardData.setData('text/html', '<p>[Calendar unavailable]</p>');
      }}
    >
      <MonthControls month={month} onChange={setMonth} />
      <Suspense fallback={<p>Loading calendar…</p>}>
        <LazyMonthGrid month={month} items={context.items} />
      </Suspense>
    </div>
  );
}

const calendar = createReactBlockSpec(
  { type: 'calendar', propSchema: {}, content: 'none' },
  {
    render: CalendarBlock,
    // Экспорт не должен использовать render: там доступен приватный runtime-контекст.
    toExternalHTML: () => <p>[Calendar unavailable]</p>,
  },
);

// Одна схема для JSON editable/readonly и Y.XmlFragment, пока только в изолированном стенде.
export const calendarSpikeSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, calendar: calendar() },
});
