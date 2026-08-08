import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthCookieService } from '../auth/auth-cookie.service';
import type { AuthenticatedRequest, AuthRequest, JwtAccessPayload } from '../types/auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = this.authCookieService.getAccessToken(request.cookies);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token);
      (request as AuthenticatedRequest).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
