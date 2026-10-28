import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { CreatePageInput, Page, UpdatePageInput, UserRole } from '@noto/shared';

import { hasMinimumProjectRole } from '../guards/project-role.utils';
import { ApiErrors, ApiException } from '../lib/errors';
import { toPublicPage } from '../lib/utils';
import { PrismaService } from '../prisma/prisma.service';
import { pageSearchResponse } from '@noto/shared/dist/api/schemas/page';

/** Предохранитель от патологических деревьев (спека pages.spec.md). */
const PAGE_TREE_MAX_DEPTH = 10;
const trashCursorSchema = z.object({ deletedAt: z.iso.datetime(), id: z.uuid() }).strict();
const pageCursorSchema = z
  .object({
    q: z.string(),
    projectId: z.uuid().nullable(),
    title: z.string(),
    id: z.uuid(),
  })
  .strict();

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    projectId: string,
    userId: string,
    input: CreatePageInput,
    currentUserRole: UserRole,
  ): Promise<Page> {
    const page = await this.runInSerializableTx(async (tx) => {
      const parentId = await this.resolveParentId(tx, projectId, input.parentId);
      const position = input.position ?? (await this.nextPosition(tx, projectId, parentId));
      if (input.position !== undefined) {
        await this.shiftSiblingsForInsert(tx, projectId, parentId, position);
      }
      return tx.page.create({
        data: {
          projectId,
          parentId,
          createdById: userId,
          title: input.title,
          content: (input.content ?? []) as Prisma.InputJsonValue,
          position,
        },
      });
    });

    return toPublicPage(page, currentUserRole);
  }

  /**
   * Serializable-транзакция с ограниченным retry: при конфликте сериализации
   * PostgreSQL отменяет транзакцию, Prisma бросает P2034 — повторяем колбэк,
   * иначе клиент получил бы 500 на легитимной гонке.
   */
  private async runInSerializableTx<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const isSerializationFailure =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';

        if (isSerializationFailure && attempt < MAX_ATTEMPTS) {
          continue;
        }

        throw error;
      }
    }
  }

  async listByProject(projectId: string, currentUserRole: UserRole): Promise<Page[]> {
    const pages = await this.prisma.page.findMany({
      where: { projectId, deletedAt: null },
      // Вторичный ключ createdAt — детерминизм при равных position (например у
      // страниц, созданных до append-at-end).
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    return pages.map((page) => toPublicPage(page, currentUserRole));
  }

  async listTrash(
    projectId: string,
    query: { limit: number; cursor?: string },
  ): Promise<{
    pages: Array<{
      id: string;
      projectId: string;
      parentId: string | null;
      title: string;
      position: number;
      deletedAt: string;
    }>;
    nextCursor: string | null;
  }> {
    let cursor: z.infer<typeof trashCursorSchema> | undefined;
    if (query.cursor !== undefined) {
      try {
        if (!/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw new Error('Invalid cursor');
        cursor = trashCursorSchema.parse(
          JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')),
        );
      } catch {
        throw ApiErrors.validation('Invalid trash cursor');
      }
    }

    const rows = await this.prisma.page.findMany({
      where: {
        projectId,
        deletedAt: { not: null },
        ...(cursor
          ? {
              OR: [
                { deletedAt: { lt: new Date(cursor.deletedAt) } },
                { deletedAt: new Date(cursor.deletedAt), id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        projectId: true,
        parentId: true,
        title: true,
        position: true,
        deletedAt: true,
      },
      orderBy: [{ deletedAt: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const pageRows = rows.slice(0, query.limit);
    const last = pageRows.at(-1);
    return {
      pages: pageRows.map((row) => ({ ...row, deletedAt: row.deletedAt!.toISOString() })),
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ deletedAt: last.deletedAt!.toISOString(), id: last.id }),
            ).toString('base64url')
          : null,
    };
  }

  async search(
    query: { q: string; projectId?: string; limit: number; cursor?: string },
    userId: string,
  ): Promise<pageSearchResponse> {
    let cursor: z.infer<typeof pageCursorSchema> | undefined;
    if (query.cursor !== undefined) {
      try {
        if (!/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw new Error('Invalid cursor');
        cursor = pageCursorSchema.parse(
          JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')),
        );
      } catch {
        throw ApiErrors.validation('Invalid search cursor');
      }

      if (cursor.q !== query.q || cursor.projectId !== (query.projectId ?? null)) {
        throw ApiErrors.validation('Search cursor does not match query');
      }
    }

    let projects: Array<{ name: string; id: string }>;
    if (query.projectId !== undefined) {
      const project = await this.prisma.project.findFirst({
        where: { id: query.projectId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!project) {
        throw ApiErrors.notFound('Project not found');
      }

      const membership = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: query.projectId, userId } },
        select: { projectId: true },
      });
      if (!membership) throw ApiErrors.forbidden();

      projects = [project];
    } else {
      const userMemberships = await this.prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      projects = await this.prisma.project.findMany({
        where: {
          id: { in: userMemberships.map((el) => el.projectId) },
          deletedAt: null,
        },
        select: { name: true, id: true },
      });
    }

    if (projects.length === 0) {
      return { results: [], nextCursor: null };
    }

    const escapedQuery = query.q.replace(/[\\%_]/g, '\\$&');
    const candidates = await this.prisma.page.findMany({
      where: {
        projectId: { in: projects.map((project) => project.id) },
        title: { contains: escapedQuery, mode: 'insensitive' },
        deletedAt: null,
        ...(cursor
          ? {
              OR: [{ title: { gt: cursor.title } }, { title: cursor.title, id: { gt: cursor.id } }],
            }
          : {}),
      },
      select: { id: true, projectId: true, title: true, parentId: true },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });

    const invalidPageIds = new Set<string>();
    let ancestorLinks = candidates.flatMap((candidate) =>
      candidate.parentId === null
        ? []
        : [{ pageId: candidate.id, projectId: candidate.projectId, parentId: candidate.parentId }],
    );

    for (let depth = 1; ancestorLinks.length > 0; depth += 1) {
      const ancestorIds = [...new Set(ancestorLinks.map((link) => link.parentId))];
      const ancestors = await this.prisma.page.findMany({
        where: { id: { in: ancestorIds } },
        select: { id: true, projectId: true, parentId: true, deletedAt: true },
      });
      const ancestorsById = new Map(ancestors.map((ancestor) => [ancestor.id, ancestor]));
      const nextLinks: typeof ancestorLinks = [];

      for (const link of ancestorLinks) {
        const ancestor = ancestorsById.get(link.parentId);
        if (
          !ancestor ||
          ancestor.deletedAt !== null ||
          ancestor.projectId !== link.projectId ||
          depth >= PAGE_TREE_MAX_DEPTH
        ) {
          invalidPageIds.add(link.pageId);
          continue;
        }

        if (ancestor.parentId !== null) {
          nextLinks.push({ ...link, parentId: ancestor.parentId });
        }
      }

      ancestorLinks = nextLinks;
    }

    const pageRows = candidates.filter((candidate) => !invalidPageIds.has(candidate.id));
    const hasMore = pageRows.length > query.limit;
    const resultsPage = pageRows.slice(0, query.limit);
    const last = resultsPage.at(-1);
    return {
      results: resultsPage.map(({ id, title, projectId }) => ({
        pageId: id,
        title,
        projectId,
        projectName: projects.find((el) => el.id === projectId)!.name,
      })),
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({
                q: query.q,
                projectId: query.projectId ?? null,
                title: last.title,
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }

  async restore(id: string, userId: string): Promise<Page> {
    return this.runInSerializableTx(async (tx) => {
      const page = await tx.page.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { projectId: true, parentId: true, project: { select: { deletedAt: true } } },
      });
      if (!page || page.project.deletedAt !== null) throw ApiErrors.notFound('Page not found');

      const member = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId: page.projectId, userId } },
        select: { role: true },
      });
      if (!member || !hasMinimumProjectRole(member.role, 'editor')) {
        throw ApiErrors.forbidden();
      }

      let parentId = page.parentId;
      let depth = 1;
      let blockedBy: { id: string; title: string } | undefined;
      const visited = new Set([id]);
      while (parentId !== null) {
        if (visited.has(parentId)) throw ApiErrors.conflict('Invalid page ancestry');
        visited.add(parentId);
        const ancestor: {
          id: string;
          projectId: string;
          parentId: string | null;
          deletedAt: Date | null;
          title: string;
        } | null = await tx.page.findUnique({
          where: { id: parentId },
          select: { id: true, projectId: true, parentId: true, deletedAt: true, title: true },
        });
        if (!ancestor || ancestor.projectId !== page.projectId) {
          throw ApiErrors.conflict('Invalid page ancestry');
        }
        if (ancestor.deletedAt !== null) blockedBy = { id: ancestor.id, title: ancestor.title };
        depth += 1;
        parentId = ancestor.parentId;
      }
      if (blockedBy) {
        throw new ApiException('CONFLICT', 'Deleted ancestor', {
          details: { blockedBy },
        });
      }
      if (depth > PAGE_TREE_MAX_DEPTH) throw ApiErrors.conflict('Page tree depth limit exceeded');

      const position = await this.nextPosition(tx, page.projectId, page.parentId);
      const restored = await tx.page.update({
        where: { id },
        data: { deletedAt: null, position },
      });
      return toPublicPage(restored, member.role);
    });
  }

  /** Одна живая страница по id. Доступ уже проверил PageAccessGuard. */
  async getById(id: string, currentUserRole: UserRole): Promise<Page> {
    const page = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
    });

    if (!page) {
      throw ApiErrors.notFound('Page not found');
    }

    return toPublicPage(page, currentUserRole);
  }

  /**
   * Частичный апдейт: `title`/`content` (автосейв) и перемещение по дереву
   * (`parentId`/`position`). Перемещение (валидация + запись) идёт в
   * serializable-транзакции — иначе конкурентные move (A→B и B→A) могут оба
   * пройти проверку и создать цикл (гонка между проверкой и записью).
   * Доступ уже проверил PageAccessGuard.
   */
  async update(id: string, input: UpdatePageInput, currentUserRole: UserRole): Promise<Page> {
    const isMove = input.parentId !== undefined || input.position !== undefined;

    if (!isMove) {
      return this.applyContentUpdate(id, input, currentUserRole);
    }

    return this.runInSerializableTx((tx) => this.moveInTree(tx, id, input, currentUserRole));
  }

  /**
   * Soft-delete страницы и всего её поддерева. Сбор id + updateMany — в
   * serializable-транзакции, иначе конкурентный create/move может оставить
   * живого ребёнка под уже удалённым родителем.
   * Доступ уже проверил PageAccessGuard.
   */
  async softDelete(id: string): Promise<void> {
    await this.runInSerializableTx(async (tx) => {
      const page = await tx.page.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });

      if (!page) {
        throw ApiErrors.notFound('Page not found');
      }

      const ids = await this.collectSubtreeIds(tx, id);

      await tx.page.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    });
  }

  /** Обновление без перемещения (title/content, автосейв). */
  private async applyContentUpdate(
    id: string,
    input: UpdatePageInput,
    currentUserRole: UserRole,
  ): Promise<Page> {
    const data: Prisma.PageUncheckedUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.content !== undefined) {
      data.content = input.content as Prisma.InputJsonValue;
    }

    // #109: тело collab-страницы живёт в Yjs — запись `content` разрешена только
    // в режиме `rest`. Пишем атомарно (updateMany с условием), устойчиво к гонке
    // с промоутом; запрос с `content` на collab-странице отклоняется ЦЕЛИКОМ.
    if (input.content !== undefined) {
      const res = await this.prisma.page.updateMany({
        where: { id, deletedAt: null, editorMode: 'rest' },
        data,
      });
      if (res.count === 0) {
        const exists = await this.prisma.page.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        });
        throw exists
          ? ApiErrors.conflict('Page content is managed by collaborative editing')
          : ApiErrors.notFound('Page not found');
      }
      return toPublicPage(
        await this.prisma.page.findFirstOrThrow({ where: { id } }),
        currentUserRole,
      );
    }

    const page = await this.prisma.page.update({ where: { id }, data });

    return toPublicPage(page, currentUserRole);
  }

  /** Перемещение по дереву в транзакции: валидация move + запись. */
  private async moveInTree(
    tx: Prisma.TransactionClient,
    id: string,
    input: UpdatePageInput,
    currentUserRole: UserRole,
  ): Promise<Page> {
    const current = await tx.page.findFirst({
      where: { id, deletedAt: null },
      select: { projectId: true, parentId: true, position: true, editorMode: true },
    });

    if (!current) {
      throw ApiErrors.notFound('Page not found');
    }

    // #109: любой запрос с `content` на collab-странице отклоняется целиком —
    // тело живёт в Yjs. Проверка в той же (serializable) транзакции, что и запись.
    if (input.content !== undefined && current.editorMode === 'collab') {
      throw ApiErrors.conflict('Page content is managed by collaborative editing');
    }

    // Unchecked-вариант — скалярный FK `parentId` пишем напрямую.
    const data: Prisma.PageUncheckedUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.content !== undefined) {
      data.content = input.content as Prisma.InputJsonValue;
    }

    const targetParentId = input.parentId !== undefined ? input.parentId : current.parentId;
    const parentChanged = targetParentId !== current.parentId;

    if (parentChanged) {
      await this.assertMovable(tx, id, targetParentId);
      // parentId — nullable: null = перенос в корень.
      data.parentId = targetParentId;
    }

    if (input.position !== undefined && (input.position !== current.position || parentChanged)) {
      // Вставка на позицию: сдвигаем сиблингов группы (>= position), кроме себя.
      await this.shiftSiblingsForInsert(tx, current.projectId, targetParentId, input.position, id);
      data.position = input.position;
    } else if (parentChanged && input.position === undefined) {
      // Смена родителя без явной позиции — append в конец новой группы.
      data.position = await this.nextPosition(tx, current.projectId, targetParentId);
    }
    // Иначе parentId/position не изменились — reindex пропускаем (идемпотентность).

    const page = await tx.page.update({ where: { id }, data });

    return toPublicPage(page, currentUserRole);
  }

  /** Сдвигает сиблингов группы с `position >= from` на +1 (освобождает слот). */
  private async shiftSiblingsForInsert(
    tx: Prisma.TransactionClient,
    projectId: string,
    parentId: string | null,
    from: number,
    exceptId?: string,
  ): Promise<void> {
    await tx.page.updateMany({
      where: {
        projectId,
        parentId,
        deletedAt: null,
        position: { gte: from },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { position: { increment: 1 } },
    });
  }

  /**
   * Проверяет допустимость перемещения `pageId` под `newParentId`: тот же
   * проект, не цикл, и итоговая глубина ≤ PAGE_TREE_MAX_DEPTH.
   *
   * Цикл и глубину нового родителя считаем одним обходом ВВЕРХ от него: если по
   * пути встретили `pageId`, значит новый родитель — сама страница или её
   * потомок (цикл). Высоту переносимого поддерева — одним обходом вниз.
   */
  private async assertMovable(
    tx: Prisma.TransactionClient,
    pageId: string,
    newParentId: string | null,
  ): Promise<void> {
    if (newParentId === null) {
      return; // перенос в корень — цикла нет, глубина = высота поддерева.
    }

    const moved = await tx.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: { projectId: true },
    });

    if (!moved) {
      throw ApiErrors.notFound('Page not found');
    }

    let newParentDepth = 0;
    let currentId: string | null = newParentId;
    let isNewParent = true;

    while (currentId) {
      if (currentId === pageId) {
        throw ApiErrors.validation('Cannot move a page into itself or its subtree');
      }

      const node: { projectId: string; parentId: string | null } | null = await tx.page.findFirst({
        where: { id: currentId, deletedAt: null },
        select: { projectId: true, parentId: true },
      });

      if (!node) {
        throw ApiErrors.notFound('Parent page not found');
      }

      if (isNewParent && node.projectId !== moved.projectId) {
        throw ApiErrors.validation('Parent page does not belong to this project');
      }

      newParentDepth += 1;
      isNewParent = false;
      currentId = node.parentId;
    }

    const movedHeight = await this.subtreeHeight(tx, pageId);

    if (newParentDepth + movedHeight > PAGE_TREE_MAX_DEPTH) {
      throw ApiErrors.validation('Page tree depth limit exceeded');
    }
  }

  /** Следующая позиция в конце списка сиблингов (append-at-end). */
  private async nextPosition(
    client: Prisma.TransactionClient,
    projectId: string,
    parentId: string | null,
  ): Promise<number> {
    const last = await client.page.aggregate({
      where: { projectId, parentId, deletedAt: null },
      _max: { position: true },
    });

    return (last._max.position ?? -1) + 1;
  }

  /** Id корня и всех живых потомков (BFS вниз по parentId). */
  private async collectSubtreeIds(tx: Prisma.TransactionClient, rootId: string): Promise<string[]> {
    const ids = [rootId];
    let frontier = [rootId];

    while (frontier.length > 0) {
      const children = await tx.page.findMany({
        where: { parentId: { in: frontier }, deletedAt: null },
        select: { id: true },
      });
      frontier = children.map((child) => child.id);
      ids.push(...frontier);
    }

    return ids;
  }

  /** Высота поддерева (число уровней; лист = 1), обход вниз по parentId. */
  private async subtreeHeight(tx: Prisma.TransactionClient, rootId: string): Promise<number> {
    let height = 0;
    let frontier = [rootId];

    while (frontier.length > 0) {
      height += 1;
      const children = await tx.page.findMany({
        where: { parentId: { in: frontier }, deletedAt: null },
        select: { id: true },
      });
      frontier = children.map((child) => child.id);
    }

    return height;
  }

  /**
   * parentId должен указывать на живую страницу того же проекта;
   * глубина нового узла (включая его самого) не больше PAGE_TREE_MAX_DEPTH.
   */
  private async resolveParentId(
    tx: Prisma.TransactionClient,
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

      const node: { projectId: string; parentId: string | null } | null = await tx.page.findFirst({
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
