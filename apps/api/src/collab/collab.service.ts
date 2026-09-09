import { Injectable } from '@nestjs/common';

import { assertProjectRole } from '../guards/assert-project-role';
import { ApiErrors } from '../lib/errors';
import { PrismaService } from '../prisma/prisma.service';

export interface CollabAuthorizeResult {
  allowed: true;
  userId: string;
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
      select: { projectId: true, project: { select: { deletedAt: true } } },
    });

    if (!page || page.project.deletedAt !== null) {
      throw ApiErrors.notFound('Page not found');
    }

    // Членство (403): минимум viewer. Ограничение записи для viewer — вне #108.
    await assertProjectRole(this.prisma, page.projectId, userId, 'viewer');

    return { allowed: true, userId };
  }
}
