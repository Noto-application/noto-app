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
