/** Payload access JWT: `sub` — id пользователя. */
export interface JwtAccessPayload {
  sub: string;
}

/** Payload refresh JWT: `sub` + `jti` для Redis allow-list. */
export interface JwtRefreshPayload {
  sub: string;
  jti: string;
}

/** Минимальный контракт Fastify-запроса с cookie (@fastify/cookie). */
export interface AuthRequest {
  cookies?: Record<string, string | undefined>;
}

/** Запрос после успешной проверки JwtAuthGuard. */
export type AuthenticatedRequest = AuthRequest & {
  user: JwtAccessPayload;
};
