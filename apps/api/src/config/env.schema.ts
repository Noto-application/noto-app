import { z } from 'zod';

/**
 * Схема переменных окружения. Валидируется при старте: приложение падает
 * сразу, а не на первом запросе к отсутствующему сервису.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // Адрес прослушивания. В dev — loopback (127.0.0.1): internal endpoint не
  // должен быть доступен в обход Caddy (#108). В контейнере/проде — 0.0.0.0,
  // а изоляцию порта API даёт приватная сеть без publish.
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  // JWT: секреты и время жизни. Refresh хранится в Redis allow-list (см. auth.spec.md).
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_REFRESH_GRACE_TTL: z.string().default('10s'),

  // Сервисный секрет internal collab-authorize endpoint (#108): им collab
  // подтверждает, что вызов идёт от него, а не снаружи. Обязателен и непустой.
  COLLAB_SHARED_SECRET: z.string().min(1),
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
