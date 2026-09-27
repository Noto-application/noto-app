import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/src/shared/lib/utils';
import { buttonVariants } from '@/src/shared/ui/button';

import { AppPreview } from './app-preview';
import { Features } from './features';
import { RotatingWord } from './rotating-word';

const REPOSITORY_URL = 'https://github.com/Noto-application/noto-app';

const CONTAINER = 'mx-auto w-full max-w-7xl px-4 sm:px-6';
const CTA_SIZE = 'h-11 px-5 text-body-lg';

type CtaProps = Readonly<{ hasSession: boolean }>;

/** Основная пара CTA: гостю — регистрация и вход, с сессией — в приложение. */
function PrimaryActions({ hasSession }: CtaProps) {
  if (hasSession) {
    return (
      <Link className={cn(buttonVariants(), CTA_SIZE)} href="/app">
        Открыть Noto
      </Link>
    );
  }

  return (
    <>
      <Link className={cn(buttonVariants(), CTA_SIZE)} href="/register">
        Начать бесплатно
      </Link>
      <Link className={cn(buttonVariants({ variant: 'secondary' }), CTA_SIZE)} href="/login">
        У меня есть аккаунт
      </Link>
    </>
  );
}

type SectionProps = Readonly<{
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}>;

function Section({ eyebrow, title, description, children }: SectionProps) {
  return (
    <section className="py-16 md:py-24">
      <div className={CONTAINER}>
        <p className="text-body-lg text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 max-w-3xl text-page-title text-balance sm:text-section">{title}</h2>
        {description && (
          <p className="mt-4 max-w-2xl text-lead text-muted-foreground">{description}</p>
        )}
        <div className="mt-10 md:mt-12">{children}</div>
      </div>
    </section>
  );
}

const PRINCIPLES = [
  {
    title: 'Страницы, а не конструктор',
    text: 'Не нужно собирать рабочее пространство из шаблонов и баз. Создали страницу — пишете.',
  },
  {
    title: 'Русский с первого дня',
    text: 'Интерфейс, подсказки и ошибки изначально на русском, а не переведены потом.',
  },
  {
    title: 'Делается открыто',
    text: 'Код, решения и roadmap лежат в открытом репозитории. Видно, что будет дальше.',
  },
] as const;

type Stage = Readonly<{
  label: string;
  status: string;
  title: string;
  items: readonly string[];
  current?: boolean;
}>;

const STAGES: readonly Stage[] = [
  {
    label: 'Этап 1',
    status: 'Сейчас',
    title: 'Основа',
    items: [
      'Регистрация и вход',
      'Проекты и страницы',
      'Перетаскивание в дереве',
      'Редактор с задачами',
      'Правки в реальном времени',
    ],
    current: true,
  },
  {
    label: 'Этап 2',
    status: 'Скоро',
    title: 'Вместе',
    items: ['Приглашения в проект', 'Курсоры участников', 'История изменений'],
  },
  {
    label: 'Этап 3',
    status: 'Позже',
    title: 'Контент',
    items: ['Картинки и видео', 'Корзина', 'Поиск по всем страницам'],
  },
  {
    label: 'Этап 4',
    status: 'Позже',
    title: 'Наружу',
    items: ['Публикация статей', 'ИИ-помощник', 'Календарь и Telegram-бот'],
  },
];

function Roadmap() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {STAGES.map((stage) => (
        <li
          key={stage.label}
          className={cn(
            'flex flex-col gap-3 p-6',
            stage.current ? 'bg-status-info-bg-soft' : 'bg-background',
          )}
        >
          <div className="flex items-center justify-between text-body text-muted-foreground">
            {stage.label}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-label',
                stage.current ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {stage.status}
            </span>
          </div>
          <h3 className="text-heading-2">{stage.title}</h3>
          <ul className="grid gap-1.5 text-body-lg">
            {stage.items.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    stage.current ? 'bg-primary' : 'border border-border-strong',
                  )}
                />
                {item}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

type LandingProps = Readonly<{
  /** Есть auth-cookie — CTA ведут в приложение, а не на регистрацию. */
  hasSession: boolean;
}>;

export function Landing({ hasSession }: LandingProps) {
  return (
    <>
      <main>
        <section className={cn(CONTAINER, 'pt-16 pb-16 text-center md:pt-24 md:pb-24')}>
          <span className="inline-flex rounded-full bg-status-info-bg-soft px-3 py-1 text-body-compact font-medium text-status-info-text">
            Ранний доступ · проект в активной разработке
          </span>
          <h1 className="mx-auto mt-6 max-w-5xl text-section text-balance sm:text-hero">
            Заметки, документы и{' '}
            <span className="whitespace-nowrap">
              <RotatingWord />.
            </span>{' '}
            Без&nbsp;лишнего.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lead text-muted-foreground">
            Noto — лёгкий редактор для личных заметок и командной документации. Страницы внутри
            страниц, задачи прямо в тексте и своя ссылка у каждой страницы.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PrimaryActions hasSession={hasSession} />
          </div>
          {!hasSession && (
            <p className="mt-4 text-body text-muted-foreground">
              Регистрация по почте, карта не нужна.
            </p>
          )}
          <div className="mx-auto mt-14 max-w-5xl md:mt-16">
            <AppPreview />
          </div>
        </section>

        <Section eyebrow="Что уже работает" title="Всё для ежедневной работы с текстом.">
          <Features />
        </Section>

        <Section
          eyebrow="Почему Noto"
          title="Меньше, чем Notion. Специально."
          description="Notion умеет почти всё. Noto умеет то, чем вы пользуетесь каждый день."
        >
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="border-t border-foreground pt-5">
                <h3 className="text-heading-2">{principle.title}</h3>
                <p className="mt-2 text-body-lg text-muted-foreground">{principle.text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Roadmap"
          title="Что уже есть и что будет."
          description="Честно: работает первый этап, остальное в разработке."
        >
          <Roadmap />
        </Section>

        <section className="bg-surface py-20 text-center md:py-24">
          <div className={CONTAINER}>
            <h2 className="text-page-title text-balance sm:text-section">
              Первая страница — за минуту.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <PrimaryActions hasSession={hasSession} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div
          className={cn(
            CONTAINER,
            'flex flex-wrap items-center justify-between gap-4 text-body text-muted-foreground',
          )}
        >
          <Link className="flex items-center gap-2 text-heading-3 text-foreground" href="/">
            <span className="flex size-6 items-center justify-center rounded-sm bg-foreground text-label text-background">
              N
            </span>
            Noto
          </Link>
          <nav aria-label="Ссылки в подвале" className="flex gap-5">
            <Link className="hover:text-foreground" href="/login">
              Войти
            </Link>
            <Link className="hover:text-foreground" href="/register">
              Регистрация
            </Link>
            <a
              className="hover:text-foreground"
              href={REPOSITORY_URL}
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </nav>
          <span>© 2026 · учебный командный проект</span>
        </div>
      </footer>
    </>
  );
}
