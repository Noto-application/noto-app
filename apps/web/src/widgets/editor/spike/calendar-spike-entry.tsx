'use client';

import dynamic from 'next/dynamic';

// BlockNote использует window при создании редактора; как и collab-editor, стенд client-only.
export const CalendarSpikeEntry = dynamic(
  () => import('./calendar-spike').then((module) => module.CalendarSpike),
  { ssr: false, loading: () => <p>Loading synthetic calendar spike…</p> },
);
