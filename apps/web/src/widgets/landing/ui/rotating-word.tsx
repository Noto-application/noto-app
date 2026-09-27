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
      {/* Все варианты лежат в одной ячейке grid: ширина плашки = самый
          длинный вариант, поэтому заголовок не прыгает при смене слова. */}
      <span
        aria-hidden="true"
        className={cn(
          'inline-grid rounded-full px-[0.3em] py-[0.04em] whitespace-nowrap transition-colors duration-300',
          word.pill,
        )}
      >
        {WORDS.map((item) => (
          <span
            key={item.text}
            // items-baseline + self-center у точки: базовая линия берётся от
            // слова, а не от пустой точки — иначе слово проседает ниже строки.
            className={cn(
              'inline-flex items-baseline justify-center gap-[0.2em] [grid-area:1/1]',
              item.text === word.text
                ? 'animate-in duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none'
                : 'invisible',
            )}
          >
            <span className={cn('size-[0.22em] shrink-0 self-center rounded-full', item.dot)} />
            {item.text}
          </span>
        ))}
      </span>
    </>
  );
}
