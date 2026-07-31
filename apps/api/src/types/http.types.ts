/** Минимальный контракт Fastify reply с @fastify/cookie (без прямой зависимости от fastify). */
export interface CookieReply {
  setCookie(name: string, value: string, options?: Record<string, unknown>): void;
  clearCookie(name: string, options?: Record<string, unknown>): void;
  status(code: number): CookieReply;
  send(payload?: unknown): unknown;
}
