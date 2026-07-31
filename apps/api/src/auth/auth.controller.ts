import { Controller, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
import type { AppRoute } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import type { ApiErrorCode } from '@noto/shared';
import { authContract } from '@noto/shared';

import { ApiExceptionFilter, toTsRestException } from '../lib/errors';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthenticatedRequest, AuthRequest } from '../types/auth.types';
import type { CookieReply } from '../types/http.types';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';

const AUTH_ERROR_ROUTES: Partial<Record<ApiErrorCode, AppRoute>> = {
  EMAIL_TAKEN: authContract.register,
  INVALID_CREDENTIALS: authContract.login,
};

@Controller()
@UseFilters(ApiExceptionFilter)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @TsRestHandler(authContract.register)
  register(@Res({ passthrough: true }) reply: CookieReply) {
    return tsRestHandler(authContract.register, async ({ body }) => {
      try {
        const result = await this.authService.register(body);
        this.authCookieService.setAuthCookies(
          reply,
          result.tokens.accessToken,
          result.tokens.refreshToken,
        );
        return { status: 201, body: { user: result.user } };
      } catch (error) {
        throw toTsRestException(error, authContract.register, AUTH_ERROR_ROUTES);
      }
    });
  }

  @TsRestHandler(authContract.login)
  login(@Res({ passthrough: true }) reply: CookieReply) {
    return tsRestHandler(authContract.login, async ({ body }) => {
      try {
        const result = await this.authService.login(body);
        this.authCookieService.setAuthCookies(
          reply,
          result.tokens.accessToken,
          result.tokens.refreshToken,
        );
        return { status: 200, body: { user: result.user } };
      } catch (error) {
        throw toTsRestException(error, authContract.login, AUTH_ERROR_ROUTES);
      }
    });
  }

  @TsRestHandler(authContract.refresh)
  refresh(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ) {
    return tsRestHandler(authContract.refresh, async () => {
      try {
        const result = await this.authService.refresh(
          this.authCookieService.getRefreshToken(request.cookies),
        );
        this.authCookieService.setAuthCookies(
          reply,
          result.tokens.accessToken,
          result.tokens.refreshToken,
        );
        return { status: 200, body: undefined };
      } catch (error) {
        throw toTsRestException(error, authContract.refresh, AUTH_ERROR_ROUTES);
      }
    });
  }

  @TsRestHandler(authContract.logout)
  logout(@Req() request: AuthRequest, @Res({ passthrough: true }) reply: CookieReply) {
    return tsRestHandler(authContract.logout, async () => {
      await this.authService.logout(
        this.authCookieService.getRefreshToken(request.cookies),
        this.authCookieService.getAccessToken(request.cookies),
      );
      this.authCookieService.clearAuthCookies(reply);
      return { status: 204, body: undefined };
    });
  }

  @UseGuards(JwtAuthGuard)
  @TsRestHandler(authContract.me)
  me(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(authContract.me, async () => {
      try {
        const result = await this.authService.getMe(request.user.sub);
        return { status: 200, body: { user: result.user } };
      } catch (error) {
        throw toTsRestException(error, authContract.me, AUTH_ERROR_ROUTES);
      }
    });
  }
}
