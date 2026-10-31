import type { Project, UserRole } from '@noto/shared';

/** Публичный project DTO — без deletedAt и внутренних полей. */
export function toPublicProject(
  project: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  },
  currentUserRole: UserRole,
): Project {
  return {
    id: project.id,
    name: project.name,
    currentUserRole,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
