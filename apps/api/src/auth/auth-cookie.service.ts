import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema';
import type { CookieReply } from '../types/http.types';

/** Имена и path cookie (ADR-003) — только здесь, наружу через методы сервиса. */
const ACCESS = 'access_token';
const REFRESH = 'refresh_token';
const REFRESH_PATH = '/api/auth/refresh';

@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  getAccessToken(cookies?: Record<string, string | undefined>): string | undefined {
    return cookies?.[ACCESS];
  }

  getRefreshToken(cookies?: Record<string, string | undefined>): string | undefined {
    return cookies?.[REFRESH];
  }

  setAuthCookies(reply: CookieReply, accessToken: string, refreshToken: string): void {
    const secure = this.config.get('NODE_ENV', { infer: true }) === 'production';

    reply.setCookie(ACCESS, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
    });

    reply.setCookie(REFRESH, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: REFRESH_PATH,
    });
  }

  clearAuthCookies(reply: CookieReply): void {
    reply.clearCookie(ACCESS, { path: '/' });
    reply.clearCookie(REFRESH, { path: REFRESH_PATH });
  }
}
