import { Injectable } from '@nestjs/common';

import { assertProjectRole } from '../guards/assert-project-role';
import { canWrite } from '../guards/project-role.utils';
import { ApiErrors } from '../lib/errors';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectRole } from '@prisma/client';

export interface CollabAuthorizeResult {
  allowed: true;
  userId: string;
  role: ProjectRole;
  canWrite: boolean;
}

/**
 * Авторизация доступа к Yjs-документу страницы (#108). Тело уже провалидировано
 * ts-rest по контракту @noto/shared/internal (documentName = uuid). Переиспользует
 * ту же проверку существования, что `PageAccessGuard` (404 на удалённую страницу/
 * проект — скрывает факт существования), и `assertProjectRole` для членства.
 */
@Injectable()
export class CollabService {
  constructor(private readonly prisma: PrismaService) {}

  async authorize(userId: string, documentName: string): Promise<CollabAuthorizeResult> {
    // Существование (404): живая страница в живом проекте — как в PageAccessGuard.
    const page = await this.prisma.page.findFirst({
      where: { id: documentName, deletedAt: null },
      select: {
        projectId: true,
        editorMode: true,
        project: { select: { deletedAt: true } },
      },
    });

    if (!page || page.project.deletedAt !== null) {
      throw ApiErrors.notFound('Page not found');
    }

    // Членство (403): минимум viewer.
    const role = await assertProjectRole(this.prisma, page.projectId, userId, 'viewer');

    // Viewer может подключаться только к уже collab-странице; REST-страница должна
    // оставаться read-only и не промоутиться через WS-доступ.
    if (role === 'viewer' && page.editorMode !== 'collab') {
      throw ApiErrors.forbidden('Viewer can only open collab pages');
    }

    // Пригодность режима (#109): editor/owner могут атомарно промоутить пустую
    // rest-страницу в collab, а rest с контентом — 409.
    if (page.editorMode !== 'collab') {
      await this.ensureCollabMode(documentName);
    }

    return { allowed: true, userId, role, canWrite: canWrite(role) };
  }

  /**
   * Первый переход в collab (#109), атомарно и безопасно к гонке:
   * промоут `rest → collab` только для пустой (`content = []`) страницы. 0 строк
   * → перечитываем режим: уже `collab` (промоутил другой одновременный клиент) →
   * пускаем; `rest` с непустым контентом → 409.
   */
  private async ensureCollabMode(pageId: string): Promise<void> {
    const promoted = await this.prisma.page.updateMany({
      where: { id: pageId, deletedAt: null, editorMode: 'rest', content: { equals: [] } },
      data: { editorMode: 'collab' },
    });
    if (promoted.count === 1) {
      return;
    }

    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: { editorMode: true },
    });
    if (page?.editorMode === 'collab') {
      return;
    }
    throw ApiErrors.conflict('Page has REST content and cannot be opened in collab');
  }
}
