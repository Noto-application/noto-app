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
});
