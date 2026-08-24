import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreatePageInput, Page, UpdatePageInput } from '@noto/shared';

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

    const build = (position: number): Prisma.PageUncheckedCreateInput => ({
      projectId,
      parentId,
      createdById: userId,
      title: input.title,
      content: (input.content ?? []) as Prisma.InputJsonValue,
      position,
    });

    // Позиция не задана — append в конец группы (сдвиг не нужен).
    if (input.position === undefined) {
      const position = await this.nextPosition(this.prisma, projectId, parentId);
      const page = await this.prisma.page.create({ data: build(position) });
      return toPublicPage(page);
    }

    // Явная позиция — вставка со сдвигом сиблингов (>= position) в транзакции.
    const position = input.position;
    const page = await this.runInSerializableTx(async (tx) => {
      await this.shiftSiblingsForInsert(tx, projectId, parentId, position);
      return tx.page.create({ data: build(position) });
    });

    return toPublicPage(page);
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

  async listByProject(projectId: string): Promise<Page[]> {
    const pages = await this.prisma.page.findMany({
      where: { projectId, deletedAt: null },
      // Вторичный ключ createdAt — детерминизм при равных position (например у
      // страниц, созданных до append-at-end).
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    return pages.map(toPublicPage);
  }

  /** Одна живая страница по id. Доступ уже проверил PageAccessGuard. */
  async getById(id: string): Promise<Page> {
    const page = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
    });

    if (!page) {
      throw ApiErrors.notFound('Page not found');
    }

    return toPublicPage(page);
  }

  /**
   * Частичный апдейт: `title`/`content` (автосейв) и перемещение по дереву
   * (`parentId`/`position`). Перемещение (валидация + запись) идёт в
   * serializable-транзакции — иначе конкурентные move (A→B и B→A) могут оба
   * пройти проверку и создать цикл (гонка между проверкой и записью).
   * Доступ уже проверил PageAccessGuard.
   */
  async update(id: string, input: UpdatePageInput): Promise<Page> {
    const isMove = input.parentId !== undefined || input.position !== undefined;

    if (!isMove) {
      return this.applyContentUpdate(id, input);
    }

    return this.runInSerializableTx((tx) => this.moveInTree(tx, id, input));
  }

  /** Обновление без перемещения (title/content, автосейв). */
  private async applyContentUpdate(id: string, input: UpdatePageInput): Promise<Page> {
    const data: Prisma.PageUncheckedUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.content !== undefined) {
      data.content = input.content as Prisma.InputJsonValue;
    }

    const page = await this.prisma.page.update({ where: { id }, data });

    return toPublicPage(page);
  }

  /** Перемещение по дереву в транзакции: валидация move + запись. */
  private async moveInTree(
    tx: Prisma.TransactionClient,
    id: string,
    input: UpdatePageInput,
  ): Promise<Page> {
    const current = await tx.page.findFirst({
      where: { id, deletedAt: null },
      select: { projectId: true, parentId: true, position: true },
    });

    if (!current) {
      throw ApiErrors.notFound('Page not found');
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

    return toPublicPage(page);
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
