import { z } from 'zod';

/** Ограничения отображаемого имени (issue #124). */
export const USERNAME_MIN_LENGTH = 1;
export const USERNAME_MAX_LENGTH = 80;

/** Username: trim по краям, 1–80 символов. Не unique — отображаемое имя. */
export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH);

/** Публичное представление пользователя — без passwordHash. */
export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  username: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type User = z.infer<typeof userSchema>;

/** Тело PATCH /users/:userId — задать или сменить username. */
export const updateUserSchema = z.object({
  username: usernameSchema,
});

/** Успешный ответ GET/PATCH профиля. */
export const userResponseSchema = z.object({
  user: userSchema,
});
