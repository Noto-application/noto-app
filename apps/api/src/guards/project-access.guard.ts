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
 * Проверяет доступ к проекту по ProjectMember (ADR-011).
 * Сначала существование (404), затем членство и роль (403).
 *
 * `projectId` берётся из path-параметра `:projectId` (единое имя во всём
 * контракте — и projects, и вложенная коллекция pages).
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
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
      throw ApiErrors.internal('ProjectAccessGuard requires @RequireProjectRole');
    }

    const request = context.switchToHttp().getRequest<RequestWithParams>();
    const projectId = request.params?.projectId;

    if (!projectId) {
      throw ApiErrors.validation('Project id is missing');
    }

    await this.assertMemberRole(projectId, request.user.sub, requiredRole);
    return true;
  }

  private async assertMemberRole(
    projectId: string,
    userId: string,
    requiredRole: ProjectRole,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { deletedAt: true },
    });

    if (!project || project.deletedAt !== null) {
      throw ApiErrors.notFound('Project not found');
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
      select: { role: true },
    });

    if (!membership) {
      throw ApiErrors.forbidden('You do not have access to this project');
    }

    if (!hasMinimumProjectRole(membership.role, requiredRole)) {
      throw ApiErrors.forbidden('Insufficient project role');
    }
  }
}
