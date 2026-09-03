import type { ProjectRole } from '@prisma/client';

import { ApiErrors } from '../lib/errors';
import type { PrismaService } from '../prisma/prisma.service';
import { hasMinimumProjectRole } from './project-role.utils';

/**
 * Проверяет доступ пользователя к проекту по ProjectMember (ADR-011):
 * не участник → 403, роль ниже требуемой → 403.
 *
 * Существование проекта/страницы (404) проверяет вызывающий guard — оно у них
 * разное (`ProjectAccessGuard` — по проекту, `PageAccessGuard` — по странице),
 * а членство и ранг роли идентичны, поэтому вынесены сюда.
 */
export async function assertProjectRole(
  prisma: PrismaService,
  projectId: string,
  userId: string,
  requiredRole: ProjectRole,
): Promise<void> {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });

  if (!membership) {
    throw ApiErrors.forbidden('You do not have access to this project');
  }

  if (!hasMinimumProjectRole(membership.role, requiredRole)) {
    throw ApiErrors.forbidden('Insufficient project role');
  }
}
