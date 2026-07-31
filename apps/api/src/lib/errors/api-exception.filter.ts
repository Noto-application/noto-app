import {
  Catch,
  ExceptionFilter,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { TsRestException, TsRestRequestValidationError } from '@ts-rest/nest';

import type { CookieReply } from '../../types/http.types';
import { ApiErrors } from './api.exception';
import { ApiException } from './api.exception';

/** Единый формат ошибок API: `{ code, message, details? }` (RFC-001). */
@Catch(HttpException)
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
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

    const status = exception.getStatus();
    const response = exception.getResponse();
    reply.status(status).send(response);
  }
}
