import { apiErrorSchema, type ApiError } from '@noto/shared/api';

export class ApiClientError extends Error {
  readonly code: ApiError['code'];
  readonly details: ApiError['details'];

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.details = error.details;
  }
}

export function toApiClientError(payload: unknown): ApiClientError {
  const result = apiErrorSchema.safeParse(payload);

  if (result.success) {
    return new ApiClientError(result.data);
  }

  return new ApiClientError({
    code: 'VALIDATION_ERROR',
    message: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
  });
}
