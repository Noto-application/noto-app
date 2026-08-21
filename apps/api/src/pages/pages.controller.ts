import { Controller, Req, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { pagesContract } from '@noto/shared';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../guards/project-access.guard';
import { RequireProjectRole } from '../guards/require-project-role.decorator';
import { toTsRestException } from '../lib/errors';
import type { AuthenticatedRequest } from '../types/auth.types';
import { PagesService } from './pages.service';

@Controller()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('editor')
  @TsRestHandler(pagesContract.create)
  create(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(pagesContract.create, async ({ params, body }) => {
      try {
        const page = await this.pagesService.create(params.projectId, request.user.sub, body);
        return { status: 201 as const, body: { page } };
      } catch (error) {
        throw toTsRestException(error, pagesContract.create);
      }
    });
  }

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('viewer')
  @TsRestHandler(pagesContract.list)
  list() {
    return tsRestHandler(pagesContract.list, async ({ params }) => {
      try {
        const pages = await this.pagesService.listByProject(params.projectId);
        return { status: 200 as const, body: { pages } };
      } catch (error) {
        throw toTsRestException(error, pagesContract.list);
      }
    });
  }
}
