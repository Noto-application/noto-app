import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Y from 'yjs';

import { ApiErrors } from '../lib/errors';
import { PrismaService } from '../prisma/prisma.service';

/** Лимит размера снапшота (декодированные байты). base64 в теле — ~+33%. */
export const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export interface CollabDocument {
  state: string;
  version: number;
}

/**
 * Persistence Yjs-снапшота страницы (#109). Хранит полное состояние + монотонную
 * версию; запись атомарна и отвергает откат устаревшей версией. Существование
 * страницы проверяется как в PageAccessGuard (404 на удалённую/в удалённом проекте).
 */
@Injectable()
export class CollabPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertPageExists(pageId: string): Promise<void> {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: { project: { select: { deletedAt: true } } },
    });
    if (!page || page.project.deletedAt !== null) {
      throw ApiErrors.notFound('Page not found');
    }
  }

  async load(pageId: string): Promise<CollabDocument | null> {
    await this.assertPageExists(pageId);
    const row = await this.prisma.pageCollabState.findUnique({
      where: { pageId },
      select: { state: true, version: true },
    });
    if (!row) {
      return null; // существующая страница без снапшота → 204 в контроллере
    }
    return { state: Buffer.from(row.state).toString('base64'), version: row.version };
  }

  async store(pageId: string, state: string, version: number): Promise<void> {
    await this.assertPageExists(pageId);

    if (!BASE64.test(state) || state.length % 4 !== 0) {
      throw ApiErrors.validation('state is not valid base64');
    }
    const bytes = Buffer.from(state, 'base64');
    if (bytes.length === 0) {
      throw ApiErrors.validation('state is empty');
    }
    if (bytes.length > MAX_SNAPSHOT_BYTES) {
      throw ApiErrors.payloadTooLarge('snapshot exceeds size limit');
    }
    // Валидность Yjs-update: должен декодироваться в документ.
    try {
      Y.applyUpdate(new Y.Doc(), bytes);
    } catch {
      throw ApiErrors.validation('state is not a valid Yjs update');
    }

    // Атомарный version-guard: пишем только если version строго новее сохранённого
    // (или снапшота ещё нет). Иначе 0 строк → 409, откат запоздавшей записью.
    const affected = await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO page_collab_states ("pageId", state, version, "updatedAt")
      VALUES (${pageId}, ${bytes}, ${version}, now())
      ON CONFLICT ("pageId") DO UPDATE
        SET state = EXCLUDED.state, version = EXCLUDED.version, "updatedAt" = now()
        WHERE page_collab_states.version < EXCLUDED.version
    `);

    if (affected === 0) {
      throw ApiErrors.conflict('stale snapshot version');
    }
  }
}
