import { z } from 'zod';

/**
 * Схема переменных окружения. Валидируется при старте: приложение падает
 * сразу, а не на первом запросе к отсутствующему сервису.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Некорректные переменные окружения:\n${details}`);
  }

  return result.data;
}
