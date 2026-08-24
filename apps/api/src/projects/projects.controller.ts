import { Controller, Req, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { projectsContract } from '@noto/shared';

import { ProjectAccessGuard } from '../guards/project-access.guard';
import { RequireProjectRole } from '../guards/require-project-role.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { toTsRestException } from '../lib/errors';
import type { AuthenticatedRequest } from '../types/auth.types';
import { ProjectsService } from './projects.service';

@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @UseGuards(JwtAuthGuard)
  @TsRestHandler(projectsContract.create)
  create(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(projectsContract.create, async ({ body }) => {
      try {
        const project = await this.projectsService.create(request.user.sub, body);
        return { status: 201 as const, body: { project } };
      } catch (error) {
        throw toTsRestException(error, projectsContract.create);
      }
    });
  }

  @UseGuards(JwtAuthGuard)
  @TsRestHandler(projectsContract.list)
  list(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(projectsContract.list, async () => {
      try {
        const projects = await this.projectsService.listForUser(request.user.sub);
        return { status: 200 as const, body: { projects } };
      } catch (error) {
        throw toTsRestException(error, projectsContract.list);
      }
    });
  }

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('viewer')
  @TsRestHandler(projectsContract.get)
  get() {
    return tsRestHandler(projectsContract.get, async ({ params }) => {
      try {
        const project = await this.projectsService.getById(params.projectId);
        return { status: 200 as const, body: { project } };
      } catch (error) {
        throw toTsRestException(error, projectsContract.get);
      }
    });
  }

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('editor')
  @TsRestHandler(projectsContract.update)
  update() {
    return tsRestHandler(projectsContract.update, async ({ params, body }) => {
      try {
        const project = await this.projectsService.update(params.projectId, body);
        return { status: 200 as const, body: { project } };
      } catch (error) {
        throw toTsRestException(error, projectsContract.update);
      }
    });
  }

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('owner')
  @TsRestHandler(projectsContract.delete)
  delete() {
    return tsRestHandler(projectsContract.delete, async ({ params }) => {
      try {
        await this.projectsService.softDelete(params.projectId);
        return { status: 204 as const, body: undefined };
      } catch (error) {
        throw toTsRestException(error, projectsContract.delete);
      }
    });
  }
}
