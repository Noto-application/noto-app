import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { hasSessionCookie } from '@/src/features/auth';
import { Landing } from '@/src/widgets/landing';

const TITLE = 'Noto — заметки, документы и проекты без лишнего';
const DESCRIPTION =
  'Лёгкий редактор для личных заметок и командной документации: вложенные страницы, задачи в тексте и правки в реальном времени.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Noto',
  },
};

export default async function LandingPage() {
  const hasSession = hasSessionCookie(await cookies());

  return <Landing hasSession={hasSession} />;
}
