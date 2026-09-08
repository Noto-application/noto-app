import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema';
import { ApiErrors } from '../lib/errors';

type RequestWithHeaders = { headers?: Record<string, string | string[] | undefined> };

/**
 * Гейт вызывающего для internal collab-authorize (#108): пропускает только
 * запросы с верным `X-Collab-Secret`. Проверяется РАНЬШЕ пользовательского
 * JWT (порядок из спеки), чтобы посторонний не мог зондировать endpoint даже
 * при наличии валидной cookie.
 */
@Injectable()
export class CollabSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const provided = request.headers?.['x-collab-secret'];
    const expected = this.config.get('COLLAB_SHARED_SECRET', { infer: true });

    if (typeof provided !== 'string' || provided !== expected) {
      throw ApiErrors.forbidden('Invalid collab secret');
    }

    return true;
  }
}
