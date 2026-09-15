import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema';
import { ttlToSeconds } from '../lib/utils';
import type { CookieReply } from '../types/http.types';

/** Имена и path cookie (ADR-003) — только здесь, наружу через методы сервиса. */
const ACCESS = 'access_token';
const REFRESH = 'refresh_token';
// #102: refresh-cookie на `Path=/`, чтобы серверный guard (Next-middleware,
// ADR-003) видел её на первом запросе к `/app` и восстанавливал сессию.
// Прежний узкий path до `/app` не долетал → «запомнить меня» не работал.
const REFRESH_PATH = '/';
// Старый узкий path из прежних сессий — вычищаем, чтобы не осталось висячей cookie.
const LEGACY_REFRESH_PATH = '/api/auth/refresh';

@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  getAccessToken(cookies?: Record<string, string | undefined>): string | undefined {
    return cookies?.[ACCESS];
  }

  getRefreshToken(cookies?: Record<string, string | undefined>): string | undefined {
    return cookies?.[REFRESH];
  }

  /**
   * `persistent` (issue #51): при `true` refresh-cookie получает `Max-Age` и
   * переживает перезапуск браузера («запомнить меня»); при `false` — сессионная,
   * как было. Access-cookie всегда сессионная — она короткоживущая, персистентность
   * держится на refresh-токене.
   */
  setAuthCookies(
    reply: CookieReply,
    accessToken: string,
    refreshToken: string,
    persistent: boolean,
  ): void {
    const secure = this.config.get('NODE_ENV', { infer: true }) === 'production';

    reply.setCookie(ACCESS, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
    });

    // Миграция: сначала убираем возможную старую cookie на узком path (иначе у
    // существующих сессий останется две refresh-cookie — новая корневая и висячая
    // узкая). Очистку ставим ПЕРЕД активной cookie, чтобы клиент с name-based
    // cookie jar (тесты) в итоге сохранил активную, а не пустую очистку.
    reply.clearCookie(REFRESH, { path: LEGACY_REFRESH_PATH });

    reply.setCookie(REFRESH, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: REFRESH_PATH,
      ...(persistent
        ? { maxAge: ttlToSeconds(this.config.get('JWT_REFRESH_TTL', { infer: true })) }
        : {}),
    });
  }

  clearAuthCookies(reply: CookieReply): void {
    reply.clearCookie(ACCESS, { path: '/' });
    reply.clearCookie(REFRESH, { path: REFRESH_PATH });
    // Чистим и старый path — на случай сессий, заведённых до #102.
    reply.clearCookie(REFRESH, { path: LEGACY_REFRESH_PATH });
  }
}
