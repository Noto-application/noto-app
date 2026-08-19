import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import type { authContract } from './contract/auth';
import type { pagesContract } from './contract/pages';
import type { projectsContract } from './contract/projects';

/** Типы запросов/ответов выводятся из ts-rest контракта (single source of truth). */
export type AuthCredentials = ServerInferRequest<
  typeof authContract.register
>['body'];

export type AuthUserResponse = Extract<
  ServerInferResponses<typeof authContract.me>,
  { status: 200 }
>['body'];

export type CreateProjectInput = ServerInferRequest<
  typeof projectsContract.create
>['body'];

export type UpdateProjectInput = ServerInferRequest<
  typeof projectsContract.update
>['body'];

export type ProjectResponse = Extract<
  ServerInferResponses<typeof projectsContract.get>,
  { status: 200 }
>['body'];

export type ProjectsResponse = Extract<
  ServerInferResponses<typeof projectsContract.list>,
  { status: 200 }
>['body'];

export type CreatePageInput = ServerInferRequest<
  typeof pagesContract.create
>['body'];

export type UpdatePageInput = ServerInferRequest<
  typeof pagesContract.update
>['body'];

export type PageResponse = Extract<
  ServerInferResponses<typeof pagesContract.get>,
  { status: 200 }
>['body'];

export type PagesResponse = Extract<
  ServerInferResponses<typeof pagesContract.list>,
  { status: 200 }
>['body'];
