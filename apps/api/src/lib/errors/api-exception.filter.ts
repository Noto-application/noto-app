import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { TsRestException, TsRestRequestValidationError } from '@ts-rest/nest';

import type { CookieReply } from '../../types/http.types';
import { ApiErrors } from './api.exception';
import { ApiException } from './api.exception';

/**
 * Единый формат ошибок API: `{ code, message, details? }` (RFC-001).
 *
 * `@Catch()` без аргумента — ловит всё, а не только `HttpException`:
 * непредвиденные ошибки (Prisma, runtime) иначе прошли бы мимо и Nest отдал
 * бы голый 500 вне общего shape, с риском утечки внутренностей. Регистрируется
 * глобально как `APP_FILTER` (см. `app.module.ts`).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<CookieReply>();

    if (exception instanceof TsRestException) {
      reply.status(exception.getStatus()).send(exception.getResponse());
      return;
    }

    if (exception instanceof ApiException) {
      reply.status(exception.getStatus()).send(exception.toBody());
      return;
    }

    if (exception instanceof TsRestRequestValidationError) {
      reply.status(400).send(
        ApiErrors.validation('Validation failed', {
          body: exception.body,
          query: exception.query,
          pathParams: exception.pathParams,
          headers: exception.headers,
        }).toBody(),
      );
      return;
    }

    if (exception instanceof UnauthorizedException) {
      reply.status(401).send(ApiErrors.unauthorized().toBody());
      return;
    }

    if (exception instanceof HttpException) {
      reply.status(exception.getStatus()).send(exception.getResponse());
      return;
    }

    // Не HttpException (Prisma, runtime, ...): полностью логируем на сервере,
    // клиенту — generic INTERNAL в общем shape, без stack и деталей.
    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    );
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send(ApiErrors.internal().toBody());
  }
}
