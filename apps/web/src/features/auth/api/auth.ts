import type { AuthCredentials, AuthUserResponse, LoginCredentials } from '@noto/shared/api';

import { apiClient, toApiClientError } from '@/src/shared/api';

export async function login(credentials: LoginCredentials): Promise<AuthUserResponse> {
  const response = await apiClient.auth.login({ body: credentials });

  if (response.status !== 200) {
    throw toApiClientError(response.body);
  }

  return response.body;
}

export async function register(credentials: AuthCredentials): Promise<AuthUserResponse> {
  const response = await apiClient.auth.register({ body: credentials });

  if (response.status !== 201) {
    throw toApiClientError(response.body);
  }

  return response.body;
}

export async function logout(): Promise<void> {
  const response = await apiClient.auth.logout();

  if (response.status !== 200 && response.status !== 204) {
    throw toApiClientError(response.body);
  }
}
