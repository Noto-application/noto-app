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

/** Успешный ответ register/login/me — только user, токены в HttpOnly cookie. */
export const authUserResponseSchema = z.object({
  user: userSchema,
});
