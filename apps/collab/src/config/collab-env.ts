/**
 * Конфиг collab-сервиса (#108). Валидируется при загрузке: пустой/отсутствующий
 * COLLAB_SHARED_SECRET запрещает старт (а не падает на первом WS-коннекте).
 * Контракт — docs/specs/108-collab-auth.spec.md.
 */

export interface CollabConfig {
  port: number;
  sharedSecret: string;
  allowedOrigins: string[];
  apiInternalUrl: string;
}

type RawEnv = Record<string, string | undefined>;

export function loadCollabConfig(env: RawEnv): CollabConfig {
  const sharedSecret = env.COLLAB_SHARED_SECRET;
  if (!sharedSecret || sharedSecret.trim() === '') {
    throw new Error('COLLAB_SHARED_SECRET is required and must be non-empty');
  }

  const allowedOrigins = (env.COLLAB_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (allowedOrigins.length === 0) {
    throw new Error('COLLAB_ALLOWED_ORIGINS is required (comma-separated origins)');
  }

  const apiInternalUrl = env.API_INTERNAL_URL;
  if (!apiInternalUrl || apiInternalUrl.trim() === '') {
    throw new Error('API_INTERNAL_URL is required');
  }

  const port = Number(env.PORT ?? '5000');
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return { port, sharedSecret, allowedOrigins, apiInternalUrl };
}
