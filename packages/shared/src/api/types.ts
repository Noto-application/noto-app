import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import type { authContract } from './contract/auth';

/** Типы запросов/ответов выводятся из ts-rest контракта (single source of truth). */
export type AuthCredentials = ServerInferRequest<
  typeof authContract.register
>['body'];

export type AuthUserResponse = Extract<
  ServerInferResponses<typeof authContract.me>,
  { status: 200 }
>['body'];
