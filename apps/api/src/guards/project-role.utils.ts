import type { ProjectRole } from '@prisma/client';

/** Иерархия ролей: owner > editor > viewer (ADR-011). */
const PROJECT_ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function hasMinimumProjectRole(
  userRole: ProjectRole,
  requiredRole: ProjectRole,
): boolean {
  return PROJECT_ROLE_RANK[userRole] >= PROJECT_ROLE_RANK[requiredRole];
}
