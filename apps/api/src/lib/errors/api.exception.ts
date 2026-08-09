import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@noto/shared';

/** HTTP-статус по умолчанию для каждого машиночитаемого кода ошибки. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
};

export interface ApiExceptionOptions {
  status?: number;
  details?: unknown;
}

/**
 * Базовое исключение API — единый shape `{ code, message, details? }` (RFC-001).
 * Бросается из сервисов; фильтр и ts-rest-адаптер отдают тело клиенту.
 */
export class ApiException extends HttpException {
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, options?: ApiExceptionOptions) {
    const status = options?.status ?? API_ERROR_STATUS[code];
    const body = ApiException.toBody(code, message, options?.details);

    super(body, status);
    this.code = code;
    this.details = options?.details;
  }

  toBody(): ApiError {
    return this.getResponse() as ApiError;
  }

  static toBody(code: ApiErrorCode, message: string, details?: unknown): ApiError {
    return details !== undefined ? { code, message, details } : { code, message };
  }
}

/** Фабрики частых ошибок — единая точка для сообщений и кодов. */
export const ApiErrors = {
  unauthorized(message = 'Unauthorized', details?: unknown): ApiException {
    return new ApiException('UNAUTHORIZED', message, { details });
  },

  invalidCredentials(message = 'Invalid email or password'): ApiException {
    return new ApiException('INVALID_CREDENTIALS', message);
  },

  emailTaken(message = 'Email is already registered'): ApiException {
    return new ApiException('EMAIL_TAKEN', message);
  },

  validation(message = 'Validation failed', details?: unknown): ApiException {
    return new ApiException('VALIDATION_ERROR', message, { details });
  },
} as const;
