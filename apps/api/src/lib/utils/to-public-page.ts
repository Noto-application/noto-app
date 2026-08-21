import type { Page } from '@noto/shared';
import type { Prisma } from '@prisma/client';

/** Публичный page DTO — без deletedAt, createdById и внутренних полей. */
export function toPublicPage(page: {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  content: Prisma.JsonValue;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}): Page {
  return {
    id: page.id,
    projectId: page.projectId,
    parentId: page.parentId,
    title: page.title,
    content: Array.isArray(page.content) ? page.content : [],
    position: page.position,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}
