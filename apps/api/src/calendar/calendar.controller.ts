import { Controller, Req, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { calendarContract } from '@noto/shared';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../guards/project-access.guard';
import { RequireProjectRole } from '../guards/require-project-role.decorator';
import { toTsRestException } from '../lib/errors';
import type { AuthenticatedRequest } from '../types/auth.types';
import { CalendarService } from './calendar.service';

@Controller()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('viewer')
  @TsRestHandler(calendarContract.list)
  list() {
    return tsRestHandler(calendarContract.list, async ({ params, query }) => {
      try {
        const entries = await this.calendarService.list(params.projectId, query.from, query.to);
        return { status: 200 as const, body: { entries } };
      } catch (error) {
        throw toTsRestException(error, calendarContract.list);
      }
    });
  }

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('editor')
  @TsRestHandler(calendarContract.create)
  create(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(calendarContract.create, async ({ params, body }) => {
      try {
        const result = await this.calendarService.create(params.projectId, request.user.sub, body);
        return result.created
          ? { status: 201 as const, body: result.body }
          : { status: 200 as const, body: result.body };
      } catch (error) {
        throw toTsRestException(error, calendarContract.create);
      }
    });
  }

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('editor')
  @TsRestHandler(calendarContract.update)
  update() {
    return tsRestHandler(calendarContract.update, async ({ params, body }) => {
      try {
        const entry = await this.calendarService.update(params.projectId, params.pageId, body);
        return { status: 200 as const, body: { entry } };
      } catch (error) {
        throw toTsRestException(error, calendarContract.update);
      }
    });
  }
}
