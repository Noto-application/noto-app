import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ProjectRole } from '@prisma/client';

import { ApiErrors } from '../lib/errors';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../types/auth.types';
import { assertProjectRole } from './assert-project-role';
import { REQUIRE_PROJECT_ROLE_KEY } from './require-project-role.decorator';

/** Только restore: удалённая страница существует, если её проект ещё жив. */
@Injectable()
export class DeletedPageAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<ProjectRole>(REQUIRE_PROJECT_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRole)
      throw ApiErrors.internal('DeletedPageAccessGuard requires @RequireProjectRole');

    const request = context.switchToHttp().getRequest<
      AuthenticatedRequest & {
        params?: Record<string, string>;
      }
    >();
    const pageId = request.params?.pageId;
    if (!pageId) throw ApiErrors.validation('Page id is missing');

    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: { not: null } },
      select: { projectId: true, project: { select: { deletedAt: true } } },
    });
    if (!page || page.project.deletedAt !== null) throw ApiErrors.notFound('Page not found');

    await assertProjectRole(this.prisma, page.projectId, request.user.sub, requiredRole);
    return true;
  }
}
