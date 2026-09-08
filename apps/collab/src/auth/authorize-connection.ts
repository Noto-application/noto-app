/**
 * Решение авторизации Yjs-документа на WS-хендшейке (#108). Чистая логция:
 * allowlist origin → извлечение access_token → делегирование в API →
 * fail-closed на всё, кроме валидного 200 { allowed: true, userId }.
 * Контракт — docs/specs/108-collab-auth.spec.md.
 */

export interface CollabAuthApiRequest {
  documentName: string;
  accessToken: string;
  secret: string;
  /** Отмена запроса по таймауту — чтобы зависший HTTP не жил после deny. */
  signal?: AbortSignal;
}

export interface CollabAuthApiResponse {
  status: number;
  body: unknown;
}

export interface CollabAuthApi {
  authorize(request: CollabAuthApiRequest): Promise<CollabAuthApiResponse>;
}

export interface CollabLogger {
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface AuthorizeDeps {
  allowedOrigins: string[];
  secret: string;
  timeoutMs: number;
  api: CollabAuthApi;
  logger: CollabLogger;
}

export interface AuthorizeInput {
  origin?: string | null;
  cookieHeader?: string | null;
  documentName?: string | null;
}

export type AuthorizeResult = { allowed: true; userId: string } | { allowed: false };

const DENIED: AuthorizeResult = { allowed: false };

/** Извлекает значение cookie по имени; пустое значение считается отсутствующим. */
function extractCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      return value.length > 0 ? value : undefined;
    }
  }
  return undefined;
}

/**
 * Зовёт API с таймаутом. По истечении ms: отменяет HTTP через AbortController
 * (иначе зависший запрос живёт после deny) И отклоняет обещание — fail-closed
 * даже если клиент/мок не среагировал на abort.
 */
function callWithTimeout(
  api: CollabAuthApi,
  request: Omit<CollabAuthApiRequest, 'signal'>,
  ms: number,
): Promise<CollabAuthApiResponse> {
  const controller = new AbortController();
  return new Promise<CollabAuthApiResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('collab authorize timeout'));
    }, ms);
    api.authorize({ ...request, signal: controller.signal }).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('collab authorize api rejected'));
      },
    );
  });
}

function isGrant(body: unknown): body is { allowed: true; userId: string } {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as { allowed?: unknown; userId?: unknown };
  return (
    candidate.allowed === true &&
    typeof candidate.userId === 'string' &&
    candidate.userId.length > 0
  );
}

export async function authorizeConnection(
  input: AuthorizeInput,
  deps: AuthorizeDeps,
): Promise<AuthorizeResult> {
  const { logger } = deps;
  const { origin, cookieHeader, documentName } = input;

  // Точное совпадение origin с allowlist — до любого обращения к API (CSWSH).
  if (!origin || !deps.allowedOrigins.includes(origin)) {
    logger.warn('collab authorize denied', { reason: 'origin' });
    return DENIED;
  }

  if (!documentName) {
    logger.warn('collab authorize denied', { reason: 'document' });
    return DENIED;
  }

  const accessToken = extractCookie(cookieHeader, 'access_token');
  if (!accessToken) {
    logger.warn('collab authorize denied', { reason: 'no-access-token' });
    return DENIED;
  }

  let response: CollabAuthApiResponse;
  try {
    response = await callWithTimeout(
      deps.api,
      { documentName, accessToken, secret: deps.secret },
      deps.timeoutMs,
    );
  } catch (error) {
    // Не логируем сам error: его message/stack может содержать токен/секрет.
    logger.warn('collab authorize denied', {
      reason: 'api-error',
      name: error instanceof Error ? error.name : 'unknown',
    });
    return DENIED;
  }

  if (response.status !== 200 || !isGrant(response.body)) {
    logger.warn('collab authorize denied', { reason: 'api-response', status: response.status });
    return DENIED;
  }

  logger.info('collab authorize granted', { documentName });
  return { allowed: true, userId: response.body.userId };
}
