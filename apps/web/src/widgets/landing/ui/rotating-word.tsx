'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/src/shared/lib/utils';

const WORDS = [
  { text: 'проекты', pill: 'bg-status-info-bg', dot: 'bg-primary' },
  { text: 'задачи', pill: 'bg-status-success-bg', dot: 'bg-success' },
  { text: 'планы', pill: 'bg-status-warning-bg', dot: 'bg-warning' },
  { text: 'идеи', pill: 'bg-status-danger-bg', dot: 'bg-destructive' },
] as const;

const INTERVAL_MS = 2400;

/**
 * Сменяемое слово в плашке внутри заголовка hero.
 *
 * Декоративное: скринридер читает статичное первое слово из `sr-only`.
 * При `prefers-reduced-motion` слово не меняется.
 */
export function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % WORDS.length);
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  const word = WORDS[index];

  return (
    <>
      <span className="sr-only">{WORDS[0].text}</span>
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center gap-[0.2em] rounded-full px-[0.3em] whitespace-nowrap transition-colors duration-300',
          word.pill,
        )}
      >
        <span className={cn('size-[0.22em] shrink-0 rounded-full', word.dot)} />
        <span
          key={word.text}
          className="animate-in duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
        >
          {word.text}
        </span>
      </span>
    </>
  );
}
