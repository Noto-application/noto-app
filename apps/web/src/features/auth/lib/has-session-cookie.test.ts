import { describe, expect, it } from 'vitest';

import { hasSessionCookie } from './has-session-cookie';

/** Минимальный стор cookie с тем же интерфейсом `get`, что у `cookies()` из Next. */
function cookieStore(values: Record<string, string>) {
  return {
    get: (name: string) => (name in values ? { name, value: values[name] } : undefined),
  };
}

describe('hasSessionCookie', () => {
  it('возвращает false без auth-cookie', () => {
    expect(hasSessionCookie(cookieStore({}))).toBe(false);
  });

  it('возвращает true при access-cookie', () => {
    expect(hasSessionCookie(cookieStore({ access_token: 'a' }))).toBe(true);
  });

  it('возвращает true при одной refresh-cookie (access истекла, сессию восстановит proxy)', () => {
    expect(hasSessionCookie(cookieStore({ refresh_token: 'r' }))).toBe(true);
  });

  it('считает пустое значение отсутствующей cookie', () => {
    expect(hasSessionCookie(cookieStore({ access_token: '', refresh_token: '' }))).toBe(false);
  });

  it('игнорирует посторонние cookie', () => {
    expect(hasSessionCookie(cookieStore({ theme: 'dark' }))).toBe(false);
  });
});
