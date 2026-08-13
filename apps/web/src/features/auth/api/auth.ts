import type { AuthCredentials, AuthUserResponse } from '@noto/shared/api';

import { apiClient, toApiClientError } from '@/src/shared/api';

export async function login(credentials: AuthCredentials): Promise<AuthUserResponse> {
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
