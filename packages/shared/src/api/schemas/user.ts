import { z } from 'zod';

/** Публичное представление пользователя — без passwordHash. */
export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});

export type User = z.infer<typeof userSchema>;
