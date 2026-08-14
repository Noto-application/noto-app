import type { Project } from '@noto/shared';

/** Публичный project DTO — без deletedAt и внутренних полей. */
export function toPublicProject(project: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): Project {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
