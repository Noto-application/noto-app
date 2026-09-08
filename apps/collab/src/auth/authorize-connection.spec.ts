import { authorizeConnection, type AuthorizeDeps } from './authorize-connection';

/**
 * Unit `authorizeConnection` — test-first (ADR-013), контракт из
 * docs/specs/108-collab-auth.spec.md.
 *
 * Чистая логика решения на WS-хендшейке: allowlist origin, извлечение
 * access_token из cookie, делегирование в API и fail-closed на всё, кроме
 * валидного 200 { allowed: true, userId }. Сам Hocuspocus/WS — вне тестов
 * (realtime = спайк по CLAUDE.md).
 *
 * Красные до реализации: модуля ./authorize-connection ещё нет.
 */

const ALLOWED_ORIGIN = 'http://localhost:3000';
const SECOND_ORIGIN = 'https://app.noto.example';
const SECRET = 'service-secret';
const TIMEOUT_MS = 1000;

interface DepsOverrides {
  authorize?: jest.Mock;
  allowedOrigins?: string[];
  secret?: string;
  timeoutMs?: number;
}

function makeDeps(overrides: DepsOverrides = {}): {
  deps: AuthorizeDeps;
  authorize: jest.Mock;
  warn: jest.Mock;
  info: jest.Mock;
  error: jest.Mock;
} {
  const authorize = overrides.authorize ?? jest.fn();
  const warn = jest.fn();
  const info = jest.fn();
  const error = jest.fn();
  const deps: AuthorizeDeps = {
    allowedOrigins: overrides.allowedOrigins ?? [ALLOWED_ORIGIN, SECOND_ORIGIN],
    secret: overrides.secret ?? SECRET,
    timeoutMs: overrides.timeoutMs ?? TIMEOUT_MS,
    api: { authorize },
    logger: { warn, info, error },
  };
  return { deps, authorize, warn, info, error };
}

const okInput = {
  origin: ALLOWED_ORIGIN,
  cookieHeader: 'access_token=tok-123; theme=dark',
  documentName: '11111111-1111-1111-1111-111111111111',
};

describe('authorizeConnection — origin allowlist (API не зовём)', () => {
  it('origin отсутствует → deny', async () => {
    const { deps, authorize } = makeDeps();
    const result = await authorizeConnection({ ...okInput, origin: undefined }, deps);
    expect(result).toEqual({ allowed: false });
    expect(authorize).not.toHaveBeenCalled();
  });

  it('origin === "null" → deny', async () => {
    const { deps, authorize } = makeDeps();
    const result = await authorizeConnection({ ...okInput, origin: 'null' }, deps);
    expect(result).toEqual({ allowed: false });
    expect(authorize).not.toHaveBeenCalled();
  });

  it('чужой origin → deny', async () => {
    const { deps, authorize } = makeDeps();
    const result = await authorizeConnection(
      { ...okInput, origin: 'https://evil.example' },
      deps,
    );
    expect(result).toEqual({ allowed: false });
    expect(authorize).not.toHaveBeenCalled();
  });

  it('похожий origin (лишний слэш) → deny, сравнение точное', async () => {
    const { deps, authorize } = makeDeps();
    const result = await authorizeConnection(
      { ...okInput, origin: `${ALLOWED_ORIGIN}/` },
      deps,
    );
    expect(result).toEqual({ allowed: false });
    expect(authorize).not.toHaveBeenCalled();
  });

  it('origin — ВТОРОЙ в allowlist → allow (не только [0])', async () => {
    const { deps } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 200, body: { allowed: true, userId: 'user-1' } }),
    });
    const result = await authorizeConnection({ ...okInput, origin: SECOND_ORIGIN }, deps);
    expect(result).toEqual({ allowed: true, userId: 'user-1' });
  });
});

describe('authorizeConnection — предусловия (API не зовём)', () => {
  it('пустой documentName → deny', async () => {
    const { deps, authorize } = makeDeps();
    const result = await authorizeConnection({ ...okInput, documentName: '' }, deps);
    expect(result).toEqual({ allowed: false });
    expect(authorize).not.toHaveBeenCalled();
  });

  it('в cookie нет access_token → deny', async () => {
    const { deps, authorize } = makeDeps();
    const result = await authorizeConnection(
      { ...okInput, cookieHeader: 'theme=dark; other=1' },
      deps,
    );
    expect(result).toEqual({ allowed: false });
    expect(authorize).not.toHaveBeenCalled();
  });

  it('access_token НЕ первый в списке → извлекается, allow', async () => {
    const { deps, authorize } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 200, body: { allowed: true, userId: 'user-1' } }),
    });
    const result = await authorizeConnection(
      { ...okInput, cookieHeader: 'theme=dark; access_token=tok-123; other=1' },
      deps,
    );
    expect(result).toEqual({ allowed: true, userId: 'user-1' });
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'tok-123' }),
    );
  });

  it('cookieHeader отсутствует (undefined) → deny', async () => {
    const { deps, authorize } = makeDeps();
    const result = await authorizeConnection({ ...okInput, cookieHeader: undefined }, deps);
    expect(result).toEqual({ allowed: false });
    expect(authorize).not.toHaveBeenCalled();
  });

  it('access_token пустой (access_token=) → deny', async () => {
    const { deps, authorize } = makeDeps();
    const result = await authorizeConnection(
      { ...okInput, cookieHeader: 'access_token=; theme=dark' },
      deps,
    );
    expect(result).toEqual({ allowed: false });
    expect(authorize).not.toHaveBeenCalled();
  });
});

describe('authorizeConnection — happy path и проброс в API', () => {
  it('200 { allowed:true, userId } → allow, userId проброшен', async () => {
    const { deps } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 200, body: { allowed: true, userId: 'user-1' } }),
    });
    const result = await authorizeConnection(okInput, deps);
    expect(result).toEqual({ allowed: true, userId: 'user-1' });
  });

  it('в API уходит documentName, ТОЛЬКО значение access_token и секрет', async () => {
    const { deps, authorize } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 200, body: { allowed: true, userId: 'user-1' } }),
    });
    await authorizeConnection(okInput, deps);
    expect(authorize).toHaveBeenCalledWith({
      documentName: okInput.documentName,
      accessToken: 'tok-123',
      secret: SECRET,
    });
  });
});

describe('authorizeConnection — fail-closed на не-happy ответы', () => {
  it.each([401, 403, 404, 400, 500])('status %s → deny', async (status) => {
    const { deps } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status, body: {} }),
    });
    const result = await authorizeConnection(okInput, deps);
    expect(result).toEqual({ allowed: false });
  });

  it('200 { allowed:false } → deny', async () => {
    const { deps } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 200, body: { allowed: false } }),
    });
    const result = await authorizeConnection(okInput, deps);
    expect(result).toEqual({ allowed: false });
  });

  it('200 с невалидным телом → deny', async () => {
    const { deps } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 200, body: { foo: 'bar' } }),
    });
    const result = await authorizeConnection(okInput, deps);
    expect(result).toEqual({ allowed: false });
  });

  it('200 { allowed:true } без userId → deny', async () => {
    const { deps } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 200, body: { allowed: true } }),
    });
    const result = await authorizeConnection(okInput, deps);
    expect(result).toEqual({ allowed: false });
  });

  it('200 { allowed:true, userId:"" } (пустой) → deny', async () => {
    const { deps } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 200, body: { allowed: true, userId: '' } }),
    });
    const result = await authorizeConnection(okInput, deps);
    expect(result).toEqual({ allowed: false });
  });

  it('API бросил (сеть) → deny', async () => {
    const { deps } = makeDeps({
      authorize: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    const result = await authorizeConnection(okInput, deps);
    expect(result).toEqual({ allowed: false });
  });

  it('таймаут API → deny', async () => {
    jest.useFakeTimers();
    try {
      // API-вызов зависает — решение должно упереться в timeoutMs и отказать.
      const { deps } = makeDeps({
        authorize: jest.fn().mockReturnValue(new Promise(() => {})),
      });
      const pending = authorizeConnection(okInput, deps);
      await jest.advanceTimersByTimeAsync(TIMEOUT_MS + 1);
      await expect(pending).resolves.toEqual({ allowed: false });
    } finally {
      jest.useRealTimers();
    }
  });
});

/**
 * Собирает ВСЕ строковые значения из аргументов логгера рекурсивно — включая
 * вложенные поля объектов и message/stack ошибок. Плоский `map(String)` давал
 * `[object Object]` и прятал утечку внутри объекта/ошибки.
 */
function serializeLogCalls(calls: unknown[][]): string {
  const seen = new WeakSet<object>();
  const parts: string[] = [];
  const walk = (value: unknown): void => {
    if (value == null) return;
    if (typeof value === 'string') {
      parts.push(value);
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      parts.push(String(value));
      return;
    }
    if (value instanceof Error) {
      parts.push(value.message);
      if (value.stack) parts.push(value.stack);
      return;
    }
    if (typeof value === 'object') {
      if (seen.has(value)) return;
      seen.add(value);
      for (const nested of Object.values(value as Record<string, unknown>)) walk(nested);
      return;
    }
    if (typeof value === 'bigint') parts.push(value.toString());
    // symbol/function не логируем — секрета в них быть не может.
  };
  for (const call of calls) for (const arg of call) walk(arg);
  return parts.join(' ');
}

/** Сводит аргументы логгер-моков в один текст. Изолирует any из jest.Mock. */
function loggedText(...mocks: jest.Mock[]): string {
  const calls: unknown[][] = [];
  for (const mock of mocks) {
    for (const call of mock.mock.calls as unknown[][]) calls.push(call);
  }
  return serializeLogCalls(calls);
}

describe('authorizeConnection — не логируем секреты', () => {
  it('при отказе (403) ни в warn/info/error нет access_token или секрета', async () => {
    const { deps, warn, info, error } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 403, body: {} }),
    });
    await authorizeConnection(okInput, deps);

    const logged = loggedText(warn, info, error);
    expect(logged).not.toContain('tok-123');
    expect(logged).not.toContain(SECRET);
  });

  it('при успехе (200) ни в warn/info/error нет access_token или секрета', async () => {
    const { deps, warn, info, error } = makeDeps({
      authorize: jest.fn().mockResolvedValue({ status: 200, body: { allowed: true, userId: 'user-1' } }),
    });
    await authorizeConnection(okInput, deps);

    const logged = loggedText(warn, info, error);
    expect(logged).not.toContain('tok-123');
    expect(logged).not.toContain(SECRET);
  });

  it('секрет/токен в тексте ошибки API не попадают в лог', async () => {
    const { deps, warn, info, error } = makeDeps({
      authorize: jest
        .fn()
        .mockRejectedValue(new Error(`connect failed leaking ${SECRET} and tok-123`)),
    });
    const result = await authorizeConnection(okInput, deps);

    expect(result).toEqual({ allowed: false });
    const logged = loggedText(warn, info, error);
    expect(logged).not.toContain('tok-123');
    expect(logged).not.toContain(SECRET);
  });
});
