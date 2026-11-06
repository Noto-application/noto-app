'use client';

import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';

import FullCalendar, { type CalendarRef, type DatesSetInfo } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import ru from '@fullcalendar/react/locales/ru';
import classicPlugin from '@fullcalendar/react/themes/classic';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import './month-grid.css';

export type MonthGridItem = { id: string; date: string; label: string };
export type MonthGridRange = { from: string; to: string };

export function localDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type MonthGridProps = {
  month: string;
  items: readonly MonthGridItem[];
  onRangeChange?: (range: MonthGridRange) => void;
  onDateClick?: (date: string) => void;
  onItemClick?: (id: string) => void;
};

const plugins = [classicPlugin, dayGridPlugin, interactionPlugin];

// Адаптер принимает date-only строки; домен, URL и загрузка данных остаются у вызывающего.
export function MonthGrid({
  month,
  items,
  onRangeChange,
  onDateClick,
  onItemClick,
}: MonthGridProps) {
  const ref = useRef<CalendarRef>(null);
  useEffect(() => {
    ref.current?.getApi().gotoDate(`${month}-01`);
  }, [month]);

  const events = useMemo(
    () => items.map(({ id, date, label }) => ({ id, start: date, title: label, allDay: true })),
    [items],
  );
  const datesSet = useCallback(
    ({ view }: DatesSetInfo) => {
      onRangeChange?.({ from: localDateOnly(view.activeStart), to: localDateOnly(view.activeEnd) });
    },
    [onRangeChange],
  );

  return (
    <div className="noto-month-grid">
      <FullCalendar
        ref={ref}
        plugins={plugins}
        initialView="dayGridMonth"
        initialDate={`${month}-01`}
        locale={ru}
        firstDay={1}
        timeZone="local"
        headerToolbar={false}
        fixedWeekCount={false}
        showNonCurrentDates
        height="auto"
        editable={false}
        selectable={false}
        events={events}
        datesSet={datesSet}
        dateClick={onDateClick ? (info) => onDateClick(info.dateStr) : undefined}
        eventInteractive={Boolean(onItemClick)}
        eventClick={onItemClick ? (info) => onItemClick(info.event.id) : undefined}
        eventContent={(info) => <span className="noto-month-card">{info.event.title}</span>}
      />
    </div>
  );
}
