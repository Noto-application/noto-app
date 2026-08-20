/**
 * Unit-тесты ApiExceptionFilter — test-first (RFC-008).
 *
 * Фокус на catch-all ветке (#23): непредвиденные ошибки не должны утекать
 * голым 500 вне общего shape.
 */
import { Logger, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

import { ApiErrors } from './api.exception';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  let filter: ApiExceptionFilter;
  let send: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter = new ApiExceptionFilter();
    send = jest.fn();
    status = jest.fn().mockReturnValue({ send });
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ApiException отдаётся своим статусом и телом', () => {
    filter.catch(ApiErrors.emailTaken(), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(send).toHaveBeenCalledWith({ code: 'EMAIL_TAKEN', message: 'Email is already registered' });
  });

  it('обычный HttpException сохраняет свой статус', () => {
    filter.catch(new NotFoundException('nope'), host);

    expect(status).toHaveBeenCalledWith(404);
  });

  it('не-HttpException (Prisma/runtime) → 500 generic INTERNAL, без утечки', () => {
    filter.catch(new Error('connection refused at 10.0.0.5'), host);

    // Точное тело — generic, без исходного сообщения ошибки: утечки нет.
    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({ code: 'INTERNAL', message: 'Internal server error' });
  });

  it('логирует исходную ошибку на сервере', () => {
    const spy = jest.spyOn(Logger.prototype, 'error');
    filter.catch(new Error('boom'), host);

    expect(spy).toHaveBeenCalled();
  });
});
