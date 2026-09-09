import type { User } from '@noto/shared';

/** Payload access JWT: `sub` — id пользователя. */
export interface JwtAccessPayload {
  sub: string;
}

/**
 * Payload refresh JWT: `sub` + `jti` для Redis allow-list. `persistent` несёт
 * выбор «запомнить меня» (issue #51) внутри самого токена — чтобы ротация на
 * `/refresh` сохранила режим cookie, не имея доступа к исходному запросу login.
 */
export interface JwtRefreshPayload {
  sub: string;
  jti: string;
  persistent?: boolean;
}

/** Минимальный контракт Fastify-запроса с cookie (@fastify/cookie). */
export interface AuthRequest {
  cookies?: Record<string, string | undefined>;
}

/** Запрос после успешной проверки JwtAuthGuard. */
export interface AuthenticatedRequest extends AuthRequest {
  user: JwtAccessPayload;
};

/** Контракт хеширования паролей (мокается в unit-тестах). */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

/** Пара access + refresh JWT, выдаваемая сервисом (не уходит клиенту в теле). */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
  userId: string;
  /** Режим refresh-cookie: `true` — персистентная (`Max-Age`), `false` — сессионная. */
  persistent: boolean;
}

/**
 * Итог атомарной ротации refresh (issue #50):
 * `rotated` — этот вызов выиграл гонку и записал новую пару;
 * `replay` — jti уже ротирован в grace-окне, вернуть ту же пару победителя;
 * `missing` — jti нет в allow-list (отозван или grace истёк).
 */
export type RefreshRotationResult =
  | { kind: 'rotated' }
  | { kind: 'replay'; tokens: AuthTokens }
  | { kind: 'missing' };

/** Allow-list refresh-токенов (Redis или мок в тестах). */
export interface RefreshTokenStore {
  store(userId: string, jti: string, ttlSeconds: number): Promise<void>;
  replace(userId: string, oldJti: string, newJti: string, ttlSeconds: number): Promise<void>;
  /**
   * Атомарная ротация с grace-окном (#50). Спекулятивно подписанные `tokens`
   * записываются только если этот вызов выиграл; иначе возвращается кэш победителя.
   */
  rotateWithGrace(
    userId: string,
    oldJti: string,
    newJti: string,
    tokens: AuthTokens,
    refreshTtlSeconds: number,
    graceTtlSeconds: number,
  ): Promise<RefreshRotationResult>;
  revoke(userId: string, jti: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  isActive(userId: string, jti: string): Promise<boolean>;
}

/** Результат register/login — публичный user + токены для cookie. */
export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}
