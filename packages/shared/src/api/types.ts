import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import type { authContract } from './contract/auth';
import type { calendarContract } from './contract/calendar';
import type { pagesContract } from './contract/pages';
import type { projectsContract } from './contract/projects';
import type { usersContract } from './contract/users';

/** Типы запросов/ответов выводятся из ts-rest контракта (single source of truth). */
export type AuthCredentials = ServerInferRequest<typeof authContract.register>['body'];

export type LoginCredentials = ServerInferRequest<typeof authContract.login>['body'];

export type AuthUserResponse = Extract<
  ServerInferResponses<typeof authContract.me>,
  { status: 200 }
>['body'];

export type UpdateUserInput = ServerInferRequest<typeof usersContract.update>['body'];

export type UserResponse = Extract<
  ServerInferResponses<typeof usersContract.me>,
  { status: 200 }
>['body'];

export type CreateProjectInput = ServerInferRequest<typeof projectsContract.create>['body'];

export type UpdateProjectInput = ServerInferRequest<typeof projectsContract.update>['body'];

export type ProjectResponse = Extract<
  ServerInferResponses<typeof projectsContract.get>,
  { status: 200 }
>['body'];

export type ProjectsResponse = Extract<
  ServerInferResponses<typeof projectsContract.list>,
  { status: 200 }
>['body'];

export type CreatePageInput = ServerInferRequest<typeof pagesContract.create>['body'];

export type UpdatePageInput = ServerInferRequest<typeof pagesContract.update>['body'];

export type PageResponse = Extract<
  ServerInferResponses<typeof pagesContract.get>,
  { status: 200 }
>['body'];

export type PagesResponse = Extract<
  ServerInferResponses<typeof pagesContract.list>,
  { status: 200 }
>['body'];

export type CreateCalendarPageInput = ServerInferRequest<typeof calendarContract.create>['body'];

export type UpdateCalendarEntryInput = ServerInferRequest<typeof calendarContract.update>['body'];

export type CalendarEntriesResponse = Extract<
  ServerInferResponses<typeof calendarContract.list>,
  { status: 200 }
>['body'];

export type CalendarPageResponse = Extract<
  ServerInferResponses<typeof calendarContract.create>,
  { status: 200 }
>['body'];

export type CalendarCreatedPageResponse = Extract<
  ServerInferResponses<typeof calendarContract.create>,
  { status: 201 }
>['body'];

export type CalendarEntryResponse = Extract<
  ServerInferResponses<typeof calendarContract.update>,
  { status: 200 }
>['body'];
