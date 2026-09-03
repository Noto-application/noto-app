import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * RTL вешает авто-cleanup сам только при `globals: true`; здесь хуки
 * импортируются явно, поэтому размонтирование между тестами — вручную.
 */
afterEach(() => {
  cleanup();
});

/**
 * jsdom не реализует `matchMedia` — падает любой компонент, который его
 * читает (Mantine, используется внутри `@blocknote/mantine`, проверяет
 * системную тему). Часть наборов тестов идёт под `environment: 'node'`
 * (чистая логика, без DOM) — там `window` нет вовсе, пропускаем.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = function matchMedia(this: void, query: string): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
}
