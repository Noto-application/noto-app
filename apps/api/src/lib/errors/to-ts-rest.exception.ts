import type { AppRoute } from '@ts-rest/core';
import { TsRestException } from '@ts-rest/nest';
import type { ApiErrorCode } from '@noto/shared';

import { ApiException } from './api.exception';

/**
 * Преобразует ApiException в TsRestException для contract-first контроллеров.
 * `codeRouteOverrides` — когда код ошибки привязан к конкретному route в контракте
 * (например EMAIL_TAKEN → register, INVALID_CREDENTIALS → login).
 */
export function toTsRestException<T extends AppRoute>(
  error: unknown,
  route: T,
  codeRouteOverrides?: Partial<Record<ApiErrorCode, AppRoute>>,
): TsRestException<T> {
  if (!(error instanceof ApiException)) {
    throw error;
  }

  const contractRoute = (codeRouteOverrides?.[error.code] ?? route) as T;

  return new TsRestException(contractRoute, {
    status: error.getStatus(),
    body: error.toBody(),
  } as never);
}
