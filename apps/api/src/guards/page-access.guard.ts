import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ProjectRole } from '@prisma/client';

import { ApiErrors } from '../lib/errors';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../types/auth.types';
import { hasMinimumProjectRole } from './project-role.utils';
import { REQUIRE_PROJECT_ROLE_KEY } from './require-project-role.decorator';

type RequestWithParams = AuthenticatedRequest & { params?: Record<string, string> };

/**
 * Доступ к странице по item-роуту (`/pages/:id`). Страница наследует права от
 * проекта (ADR-011): сначала существование (404 — нет страницы, страница или
 * её проект удалены), затем членство и роль (403). Такой порядок скрывает факт
 * существования удалённой/чужой страницы от не-участника.
 *
 * `projectId` резолвится из самой страницы, а не из URL (в item-роуте его нет).
 */
@Injectable()
export class PageAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<ProjectRole>(
      REQUIRE_PROJECT_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRole) {
      throw ApiErrors.internal('PageAccessGuard requires @RequireProjectRole');
    }

    const request = context.switchToHttp().getRequest<RequestWithParams>();
    const pageId = request.params?.id;

    if (!pageId) {
      throw ApiErrors.validation('Page id is missing');
    }

    // Существование (404): живая страница в живом проекте.
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: { projectId: true, project: { select: { deletedAt: true } } },
    });

    if (!page || page.project.deletedAt !== null) {
      throw ApiErrors.notFound('Page not found');
    }

    // Права (403): членство в проекте страницы и достаточная роль.
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: page.projectId, userId: request.user.sub },
      },
      select: { role: true },
    });

    if (!membership) {
      throw ApiErrors.forbidden('You do not have access to this project');
    }

    if (!hasMinimumProjectRole(membership.role, requiredRole)) {
      throw ApiErrors.forbidden('Insufficient project role');
    }

    return true;
  }
}
