import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxy } from './proxy';

// Запрос к /app с refresh-cookie (после фикса Path=/ она долетает до middleware).
function appRequest(cookie = 'refresh_token=refresh-value') {
  return new NextRequest('http://localhost/app/page-id', { headers: { cookie } });
}

/** Была ли вызвана fetch на путь, содержащий `part`. */
function calledPath(fetchMock: ReturnType<typeof vi.fn>, part: string): boolean {
  return fetchMock.mock.calls.some((args) => String(args[0]).includes(part));
}

/** cookie-заголовок, с которым звали fetch на путь `part`. */
function forwardedCookie(fetchMock: ReturnType<typeof vi.fn>, part: string): unknown {
  const call = fetchMock.mock.calls.find((args) => String(args[0]).includes(part));
  return (call?.[1] as { headers?: Record<string, unknown> } | undefined)?.headers?.cookie;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('proxy', () => {
  it('passes access → next() without refresh when /me is ok', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(appRequest());

    expect(response.headers.get('location')).toBeNull();
    expect(calledPath(fetchMock, '/auth/refresh')).toBe(false);
  });

  it('restores the session and forwards the refresh cookie to /auth/refresh', async () => {
    const refreshHeaders = new Headers();
    refreshHeaders.append('set-cookie', 'access_token=new-access; HttpOnly; Path=/');
    refreshHeaders.append('set-cookie', 'refresh_token=new-refresh; HttpOnly; Path=/');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /auth/me
      .mockResolvedValueOnce(new Response(null, { headers: refreshHeaders })); // /auth/refresh
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(appRequest('refresh_token=abc'));

    expect(response.headers.get('location')).toBeNull();
    // refresh-cookie реально проброшена на /auth/refresh
    expect(forwardedCookie(fetchMock, '/auth/refresh')).toBe('refresh_token=abc');
    expect(response.headers.getSetCookie()).toEqual([
      'access_token=new-access; HttpOnly; Path=/',
      'refresh_token=new-refresh; HttpOnly; Path=/',
    ]);
  });

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

    const response = await proxy(appRequest());

    expect(response.headers.getSetCookie()).toEqual([
      'access_token=access-value; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly; Path=/',
      'refresh_token=refresh-value; HttpOnly; Path=/',
    ]);
  });

  it('redirects to /login and clears session when refresh is genuinely invalid (401)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /auth/me
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /auth/refresh
      .mockResolvedValueOnce(new Response(null, { status: 204 })); // /auth/logout
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(appRequest());

    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirectUrl')).toBe('/app/page-id');
    expect(calledPath(fetchMock, '/auth/logout')).toBe(true); // явный logout при 401
  });

  // #102: транзиентная ошибка refresh (сервер/сеть) НЕ должна разлогинивать —
  // без вызова /auth/logout и без очищающих Set-Cookie; только явный 401 логаутит.
  it('does NOT logout on a transient refresh error (5xx)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /auth/me
      .mockResolvedValueOnce(new Response(null, { status: 503 })); // /auth/refresh — транзиент
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(appRequest());

    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(503);
    expect(calledPath(fetchMock, '/auth/logout')).toBe(false);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('does NOT logout when refresh throws (network error)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /auth/me
      .mockRejectedValueOnce(new Error('network down')); // /auth/refresh
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(appRequest());

    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(503);
    expect(calledPath(fetchMock, '/auth/logout')).toBe(false);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  // Ограничение миграции. Пользователь со СТАРОЙ узкой cookie (Path=/api/auth/refresh)
  // на ПЕРВОМ заходе в /app: браузер такую cookie на /app не шлёт → middleware её
  // не видит → refresh 401 → proxy делает logout (очищает cookie, в т.ч. legacy) и
  // редиректит на /login. После этого нужен ПОВТОРНЫЙ вход. Само-исцеление через
  // клиентский /api/auth/refresh возможно ТОЛЬКО до этого logout, не после.
  it('with only the legacy cookie on /app: proxy logs out (clears it) and requires re-login', async () => {
    const clear = new Headers();
    clear.append('set-cookie', 'access_token=; Max-Age=0; Path=/');
    clear.append('set-cookie', 'refresh_token=; Max-Age=0; Path=/');
    clear.append('set-cookie', 'refresh_token=; Max-Age=0; Path=/api/auth/refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /auth/me (нет access)
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /auth/refresh (cookie не долетела)
      .mockResolvedValueOnce(new Response(null, { headers: clear })); // /auth/logout чистит cookie
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(new NextRequest('http://localhost/app/page-id')); // без cookie на /app

    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/login');
    expect(calledPath(fetchMock, '/auth/logout')).toBe(true); // logout вызван
    // очищающие cookie проброшены в ответ → старая cookie удаляется, нужен ре-логин
    expect(response.headers.getSetCookie()).toContain(
      'refresh_token=; Max-Age=0; Path=/api/auth/refresh',
    );
  });
});
