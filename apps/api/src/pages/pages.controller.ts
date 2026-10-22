import { Controller, Req, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { pagesContract } from '@noto/shared';
import type { ProjectRole } from '@prisma/client';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DeletedPageAccessGuard } from '../guards/deleted-page-access.guard';
import { PageAccessGuard } from '../guards/page-access.guard';
import { ProjectAccessGuard } from '../guards/project-access.guard';
import { RequireProjectRole } from '../guards/require-project-role.decorator';
import { toTsRestException } from '../lib/errors';
import type { AuthenticatedRequest } from '../types/auth.types';
import { PagesService } from './pages.service';

type PageRequest = AuthenticatedRequest & { currentUserRole: ProjectRole };

@Controller()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('viewer')
  @TsRestHandler(pagesContract.trash)
  trash() {
    return tsRestHandler(pagesContract.trash, async ({ params, query }) => {
      try {
        const body = await this.pagesService.listTrash(params.projectId, query);
        return { status: 200 as const, body };
      } catch (error) {
        throw toTsRestException(error, pagesContract.trash);
      }
    });
  }

  @UseGuards(JwtAuthGuard, DeletedPageAccessGuard)
  @RequireProjectRole('editor')
  @TsRestHandler(pagesContract.restore)
  restore(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(pagesContract.restore, async ({ params }) => {
      try {
        const page = await this.pagesService.restore(params.pageId, request.user.sub);
        return { status: 200 as const, body: { page } };
      } catch (error) {
        throw toTsRestException(error, pagesContract.restore);
      }
    });
  }

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('editor')
  @TsRestHandler(pagesContract.create)
  create(@Req() request: PageRequest) {
    return tsRestHandler(pagesContract.create, async ({ params, body }) => {
      try {
        const page = await this.pagesService.create(
          params.projectId,
          request.user.sub,
          body,
          request.currentUserRole,
        );
        return { status: 201 as const, body: { page } };
      } catch (error) {
        throw toTsRestException(error, pagesContract.create);
      }
    });
  }

  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @RequireProjectRole('viewer')
  @TsRestHandler(pagesContract.list)
  list(@Req() request: PageRequest) {
    return tsRestHandler(pagesContract.list, async ({ params }) => {
      try {
        const pages = await this.pagesService.listByProject(
          params.projectId,
          request.currentUserRole,
        );
        return { status: 200 as const, body: { pages } };
      } catch (error) {
        throw toTsRestException(error, pagesContract.list);
      }
    });
  }

  @UseGuards(JwtAuthGuard, PageAccessGuard)
  @RequireProjectRole('viewer')
  @TsRestHandler(pagesContract.get)
  get(@Req() request: PageRequest) {
    return tsRestHandler(pagesContract.get, async ({ params }) => {
      try {
        const page = await this.pagesService.getById(params.pageId, request.currentUserRole);
        return { status: 200 as const, body: { page } };
      } catch (error) {
        throw toTsRestException(error, pagesContract.get);
      }
    });
  }

  @UseGuards(JwtAuthGuard, PageAccessGuard)
  @RequireProjectRole('editor')
  @TsRestHandler(pagesContract.update)
  update(@Req() request: PageRequest) {
    return tsRestHandler(pagesContract.update, async ({ params, body }) => {
      try {
        const page = await this.pagesService.update(params.pageId, body, request.currentUserRole);
        return { status: 200 as const, body: { page } };
      } catch (error) {
        throw toTsRestException(error, pagesContract.update);
      }
    });
  }

  @UseGuards(JwtAuthGuard, PageAccessGuard)
  @RequireProjectRole('editor')
  @TsRestHandler(pagesContract.delete)
  delete() {
    return tsRestHandler(pagesContract.delete, async ({ params }) => {
      try {
        await this.pagesService.softDelete(params.pageId);
        return { status: 204 as const, body: undefined };
      } catch (error) {
        throw toTsRestException(error, pagesContract.delete);
      }
    });
  }
}
