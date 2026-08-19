import { initClient, tsRestFetchApi, type ApiFetcher } from '@ts-rest/core';
import { apiContract } from '@noto/shared/api';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const apiBaseUrl = `${configuredApiUrl.replace(/\/$/, '')}/api`;

const cookieApiFetcher: ApiFetcher = async (args) => {
  const response = await tsRestFetchApi(args);

  if (response.status !== 401 || routesWithoutRefresh.has(args.route.path)) {
    return response;
  }

  if (await refreshAccessToken()) {
    return tsRestFetchApi(args);
  }

  await clearAuthSession();
  redirectToLogin();
  return response;
};

export const apiClient = initClient(apiContract, {
  api: cookieApiFetcher,
  baseUrl: apiBaseUrl,
  credentials: 'include',
});

const routesWithoutRefresh = new Set([
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/register',
]);

let refreshRequest: Promise<boolean> | undefined;
let loginRedirectInProgress = false;

function redirectToLogin(): void {
  if (typeof window === 'undefined' || loginRedirectInProgress) {
    return;
  }

  loginRedirectInProgress = true;
  window.location.assign('/login');
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshRequest = undefined;
      });
  }

  return refreshRequest;
}

async function clearAuthSession(): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Редирект всё равно нужен: ошибка сети
    // не должна оставлять пользователя в /app.
    // добавить логирование.
  }
}


