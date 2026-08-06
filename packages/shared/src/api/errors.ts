import { z } from 'zod';

/** Машиночитаемые коды ошибок API (образец для всего API, см. RFC-001). */
export const apiErrorCodeSchema = z.enum([
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'UNAUTHORIZED',
  'VALIDATION_ERROR',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Единый shape ошибок: `{ code, message, details? }`. */
export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
