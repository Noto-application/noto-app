import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CalendarEntry,
  CalendarCreatedPageResponse,
  CalendarPageResponse,
  CreateCalendarPageInput,
  UpdateCalendarEntryInput,
} from '@noto/shared';

import { ApiErrors } from '../lib/errors';
import { toPublicPage } from '../lib/utils';
import { PrismaService } from '../prisma/prisma.service';

type EntryWithPage = Prisma.CalendarEntryGetPayload<{ include: { page: true } }>;

function toEntry(entry: EntryWithPage): CalendarEntry {
  return {
    pageId: entry.pageId,
    projectId: entry.page.projectId,
    title: entry.page.title,
    date: entry.date,
    updatedAt: entry.updatedAt.toISOString(),
  };
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string, from: string, to: string): Promise<CalendarEntry[]> {
    const entries = await this.prisma.calendarEntry.findMany({
      where: { date: { gte: from, lt: to }, page: { projectId, deletedAt: null } },
      include: { page: true },
      orderBy: [{ date: 'asc' }, { pageId: 'asc' }],
    });
    return entries.map(toEntry);
  }

  async create(
    projectId: string,
    userId: string,
    input: CreateCalendarPageInput,
  ): Promise<
    | { created: true; body: CalendarCreatedPageResponse }
    | { created: false; body: CalendarPageResponse }
  > {
    const key = {
      projectId_clientRequestId: { projectId, clientRequestId: input.clientRequestId },
    };
    const existing = await this.prisma.calendarCreateRequest.findUnique({ where: key });
    if (existing) return { created: false, body: await this.replay(projectId, existing, input) };

    // Уникальный ключ остаётся арбитром гонки: проигравший откатывает все три
    // записи и читает уже зафиксированное состояние через replay.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt += 1) {
      try {
        const body = await this.prisma.$transaction(
          async (tx) => {
            const last = await tx.page.aggregate({
              where: { projectId, parentId: null, deletedAt: null },
              _max: { position: true },
            });
            const page = await tx.page.create({
              data: {
                projectId,
                parentId: null,
                createdById: userId,
                title: input.title,
                content: [],
                position: (last._max.position ?? -1) + 1,
              },
            });
            const entry = await tx.calendarEntry.create({
              data: { pageId: page.id, date: input.date },
              include: { page: true },
            });
            await tx.calendarCreateRequest.create({
              data: {
                projectId,
                clientRequestId: input.clientRequestId,
                pageId: page.id,
                title: input.title,
                date: input.date,
              },
            });
            return { page: toPublicPage(page), entry: toEntry(entry) };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return { created: true, body };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          const target = error.meta?.target;
          if (
            error.code === 'P2002' &&
            Array.isArray(target) &&
            target.includes('projectId') &&
            target.includes('clientRequestId')
          ) {
            const winner = await this.prisma.calendarCreateRequest.findUnique({ where: key });
            if (winner)
              return { created: false, body: await this.replay(projectId, winner, input) };
          }
          if (error.code === 'P2034') {
            if (attempt < MAX_ATTEMPTS) continue;
            const winner = await this.prisma.calendarCreateRequest.findUnique({ where: key });
            if (winner)
              return { created: false, body: await this.replay(projectId, winner, input) };
          }
        }
        throw error;
      }
    }
  }

  private async replay(
    projectId: string,
    request: { pageId: string; title: string; date: string },
    input: CreateCalendarPageInput,
  ): Promise<CalendarPageResponse> {
    const page = await this.prisma.page.findFirst({
      where: { id: request.pageId, projectId, deletedAt: null },
      include: { calendarEntry: true },
    });
    if (!page) throw ApiErrors.notFound('Page not found');
    if (request.title !== input.title || request.date !== input.date) {
      throw ApiErrors.conflict('Calendar create payload differs from original request');
    }
    return {
      page: toPublicPage(page),
      entry: page.calendarEntry ? toEntry({ ...page.calendarEntry, page }) : null,
    };
  }

  async update(
    projectId: string,
    pageId: string,
    input: UpdateCalendarEntryInput,
  ): Promise<CalendarEntry | null> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const page = await tx.page.findFirst({
              where: { id: pageId, projectId, deletedAt: null },
            });
            if (!page) throw ApiErrors.notFound('Page not found');

            const current = await tx.calendarEntry.findUnique({ where: { pageId } });
            if ((current?.date ?? null) === input.date) {
              return current ? toEntry({ ...current, page }) : null;
            }
            if ((current?.date ?? null) !== input.expectedDate) {
              throw ApiErrors.conflict('Calendar date has changed');
            }
            if (input.date === null) {
              await tx.calendarEntry.delete({ where: { pageId } });
              return null;
            }
            const entry = current
              ? await tx.calendarEntry.update({ where: { pageId }, data: { date: input.date } })
              : await tx.calendarEntry.create({ data: { pageId, date: input.date } });
            return toEntry({ ...entry, page });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && attempt < MAX_ATTEMPTS) {
          // P2034 — serialization failure; P2002 по уникальному pageId — проигравший
          // INSERT в гонке двух create на недатированную Page. Оба сигнала означают
          // «перечитать текущее состояние»: на повторе победившая запись уже видна.
          const target = error.meta?.target;
          const isPageIdConflict =
            error.code === 'P2002' && Array.isArray(target) && target.includes('pageId');
          if (error.code === 'P2034' || isPageIdConflict) continue;
        }
        throw error;
      }
    }
  }
}
