import { z } from 'zod';

import { userSchema } from './user';

/** Минимальная длина пароля (согласовано для register/login). */
export const AUTH_PASSWORD_MIN_LENGTH = 8;

const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email());

/** Тело запроса для register и login. Email нормализуется (trim, lowercase). */
export const authCredentialsSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(AUTH_PASSWORD_MIN_LENGTH),
});

/**
 * Тело login: те же credentials + опциональный `rememberMe` (issue #51).
 * `true` → refresh-cookie персистентная (`Max-Age`), переживает перезапуск
 * браузера; отсутствие/`false` → сессионная cookie (как было). Поле опционально,
 * поэтому старые клиенты, не знающие про него, продолжают работать без изменений.
 */
export const loginBodySchema = authCredentialsSchema.extend({
  rememberMe: z.boolean().optional(),
});

/** Успешный ответ register/login/me — только user, токены в HttpOnly cookie. */
export const authUserResponseSchema = z.object({
  user: userSchema,
});
