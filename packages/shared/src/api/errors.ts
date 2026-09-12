import { z } from 'zod';

/** Машиночитаемые коды ошибок API (образец для всего API, см. RFC-001). */
export const apiErrorCodeSchema = z.enum([
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  // 409 — конфликт состояния (устаревшая версия снапшота, collab-промоут,
  // запись тела на collab-странице) — #109.
  'CONFLICT',
  // 413 — тело/снапшот превышает лимит размера — #109.
  'PAYLOAD_TOO_LARGE',
  // Fallback для необработанных ошибок (не HttpException): catch-all фильтр
  // отдаёт его вместо голого 500 вне общего shape.
  'INTERNAL',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Единый shape ошибок: `{ code, message, details? }`. */
export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
