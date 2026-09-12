import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxy } from './proxy';

const request = new NextRequest('http://localhost/app/page-id');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('proxy', () => {
  it('forwards separate refresh cookies without parsing Expires', async () => {
    const refreshHeaders = new Headers();
    refreshHeaders.append(
      'set-cookie',
      'access_token=access-value; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly; Path=/',
    );
    refreshHeaders.append('set-cookie', 'refresh_token=refresh-value; HttpOnly; Path=/');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { headers: refreshHeaders }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(request);

    expect(response.headers.getSetCookie()).toEqual([
      'access_token=access-value; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly; Path=/',
      'refresh_token=refresh-value; HttpOnly; Path=/',
    ]);
  });

  it('does not add cookies when refresh returns none', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null));
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(request);

    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('redirects to /login with the original path when both tokens are invalid', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(request);

    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirectUrl')).toBe('/app/page-id');
  });

  // #102: транзиентная ошибка refresh (сервер/сеть) НЕ должна разлогинивать —
  // только явный 401 (невалидный refresh) ведёт на /login.
  it('does NOT logout on a transient refresh error (5xx) — keeps the session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /auth/me
      .mockResolvedValueOnce(new Response(null, { status: 503 })); // /auth/refresh — транзиент
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(request);

    // Не редирект на /login, сессия не очищается.
    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(503);
  });

  it('does NOT logout when refresh throws (network error) — keeps the session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /auth/me
      .mockRejectedValueOnce(new Error('network down')); // /auth/refresh
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(request);

    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(503);
  });

  // #102: успешное восстановление на первом заходе в /app (refresh-cookie теперь
  // Path=/, долетает до middleware) — пропускаем запрос с новой парой cookie.
  it('restores the session on /app entry: /me 401 → refresh 200 → next() with cookies', async () => {
    const refreshHeaders = new Headers();
    refreshHeaders.append('set-cookie', 'access_token=new-access; HttpOnly; Path=/');
    refreshHeaders.append('set-cookie', 'refresh_token=new-refresh; HttpOnly; Path=/');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { headers: refreshHeaders }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(request);

    expect(response.headers.get('location')).toBeNull(); // не редирект
    expect(response.headers.getSetCookie()).toEqual([
      'access_token=new-access; HttpOnly; Path=/',
      'refresh_token=new-refresh; HttpOnly; Path=/',
    ]);
  });
});
