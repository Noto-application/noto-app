import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreatePageInput, Page } from '@noto/shared';

import { ApiErrors } from '../lib/errors';
import { toPublicPage } from '../lib/utils';
import { PrismaService } from '../prisma/prisma.service';

/** Предохранитель от патологических деревьев (спека pages.spec.md). */
const PAGE_TREE_MAX_DEPTH = 10;

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, userId: string, input: CreatePageInput): Promise<Page> {
    const parentId = await this.resolveParentId(projectId, input.parentId);

    const page = await this.prisma.page.create({
      data: {
        projectId,
        parentId,
        createdById: userId,
        title: input.title,
        content: (input.content ?? []) as Prisma.InputJsonValue,
        position: input.position ?? 0,
      },
    });

    return toPublicPage(page);
  }

  async listByProject(projectId: string): Promise<Page[]> {
    const pages = await this.prisma.page.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { position: 'asc' },
    });

    return pages.map(toPublicPage);
  }

  /**
   * parentId должен указывать на живую страницу того же проекта;
   * глубина нового узла (включая его самого) не больше PAGE_TREE_MAX_DEPTH.
   */
  private async resolveParentId(
    projectId: string,
    parentId: string | null | undefined,
  ): Promise<string | null> {
    if (parentId == null) {
      return null;
    }

    let currentId: string | null = parentId;
    let depth = 1;
    let isDirectParent = true;

    while (currentId) {
      depth += 1;
      if (depth > PAGE_TREE_MAX_DEPTH) {
        throw ApiErrors.validation('Page tree depth limit exceeded');
      }

      const node: { projectId: string; parentId: string | null } | null =
        await this.prisma.page.findFirst({
          where: { id: currentId, deletedAt: null },
          select: { projectId: true, parentId: true },
        });

      if (!node) {
        throw ApiErrors.notFound('Parent page not found');
      }

      if (isDirectParent && node.projectId !== projectId) {
        throw ApiErrors.validation('Parent page does not belong to this project');
      }

      isDirectParent = false;
      currentId = node.parentId;
    }

    return parentId;
  }
}
