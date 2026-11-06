import { notFound } from 'next/navigation';

export default async function CalendarSpikePage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { CalendarSpikeEntry } = await import('@/src/widgets/editor/spike/calendar-spike-entry');
  return <CalendarSpikeEntry />;
}
