import { NextResponse, type NextRequest } from 'next/server';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const apiBaseUrl = `${configuredApiUrl.replace(/\/$/, '')}/api`;

function getSetCookies(headers: Headers): string[] {
  return headers.getSetCookie();
}

function copySetCookies(target: NextResponse, source: Response): void {
  for (const cookie of getSetCookies(source.headers)) {
    target.headers.append('set-cookie', cookie);
  }
}

async function logoutAndRedirect(
  request: NextRequest,
): Promise<NextResponse> {
  const response = NextResponse.redirect(
    new URL('/login', request.url),
  );

  try {
    const logoutResponse = await apiRequest(
      request,
      '/auth/logout',
      'POST',
    );

    copySetCookies(response, logoutResponse);
  } catch {
    // logging
  }

  return response;
}

async function apiRequest(request: NextRequest, path: string, method = 'GET'): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { cookie: request.headers.get('cookie') ?? '' },
    cache: 'no-store',
  });
}

/**
 * Проверяет access cookie до рендера /app. Если она отсутствует или устарела,
 * proxy обновляет пару токенов через refresh cookie и передаёт Set-Cookie браузеру.
 */
export async function proxy(request: NextRequest) {
  let meResponse: Response;

  try {
    meResponse = await apiRequest(request, '/auth/me');
  } catch {
    return new NextResponse('Authentication service is unavailable.', { status: 503 });
  }

  if (meResponse.ok) {
    return NextResponse.next();
  }

  if (meResponse.status !== 401) {
    return new NextResponse('Authentication service is unavailable.', { status: 503 });
  }

  try {
    const refreshResponse = await apiRequest(request, '/auth/refresh', 'POST');

    if (!refreshResponse.ok) {
      return logoutAndRedirect(request);
    }

    const response = NextResponse.next();
    copySetCookies(response, refreshResponse);
    return response;
  } catch {
    return new NextResponse('Authentication service is unavailable.', { status: 503 });
  }
}

export const config = {
  matcher: ['/app/:path*'],
};
