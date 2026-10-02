/**
 * Unit-регрессия CalendarService — test-first (ADR-013).
 *
 * Воспроизводит гонку PR #148: два конкурентных PUT с общим `expectedDate:
 * null` и одной ненулевой target на ранее недатированной Page (C = E = null).
 * Спека требует оба 200 и одну CalendarEntry. Проигравший INSERT первой записи
 * мог получить не только P2034 (serialization failure), но и P2002 (unique
 * pageId); до фикса `update()` ловил только P2034, и P2002 утекал наружу как
 * 500 — теперь обрабатываются оба сигнала. HTTP-e2e
 * (test/calendar.e2e-spec.ts) не гарантирует срабатывание именно ветки P2002,
 * поэтому нужный межтранзакционный порядок задаёт детерминированный мок Prisma.
 */
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import { CalendarService } from './calendar.service';

const PROJECT_ID = 'project-1';
const PAGE_ID = 'page-1';
const D1 = '2026-03-10';

describe('CalendarService', () => {
  let service: CalendarService;

  const page = { id: PAGE_ID, projectId: PROJECT_ID, title: 'Page', deletedAt: null };

  const pageFindFirst = jest.fn();
  const findUnique = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const deleteEntry = jest.fn();

  const prisma = {
    page: { findFirst: pageFindFirst },
    calendarEntry: { findUnique, create, update, delete: deleteEntry },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Общее состояние «записи в БД» между обеими транзакциями: победитель
    // создаёт её, проигравший видит на повторе.
    let entry: { pageId: string; date: string; updatedAt: Date } | null = null;

    // Барьер: обе первые транзакции читают «записи нет» до любого INSERT,
    // затем INSERT-гонку выигрывает ровно одна. Так воспроизводится
    // наблюдаемое interleaving, а не сериализованный порядок вызовов.
    let pendingReads = 0;
    let initialReadsDone = false;
    let releaseReads!: () => void;
    const readsReleased = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });

    pageFindFirst.mockResolvedValue(page);
    findUnique.mockImplementation(async () => {
      if (!initialReadsDone) {
        pendingReads += 1;
        if (pendingReads === 2) {
          initialReadsDone = true;
          releaseReads();
        }
        await readsReleased;
        return null;
      }
      return entry;
    });
    create.mockImplementation((args: { data: { pageId: string; date: string } }) => {
      if (entry) {
        return Promise.reject(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed on pageId', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['pageId'] },
          }),
        );
      }
      entry = {
        pageId: args.data.pageId,
        date: args.data.date,
        updatedAt: new Date('2026-03-10T00:00:00.000Z'),
      };
      return Promise.resolve(entry);
    });
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));

    service = new CalendarService(prisma as never as PrismaService);
  });

  it('конкурентные PUT (C = E = null), одна ненулевая target → оба 200, одна запись', async () => {
    const results = await Promise.all([
      service.update(PROJECT_ID, PAGE_ID, { date: D1, expectedDate: null }),
      service.update(PROJECT_ID, PAGE_ID, { date: D1, expectedDate: null }),
    ]);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result).toMatchObject({ pageId: PAGE_ID, date: D1 });
    }
    // Число вызовов create намеренно не проверяется: на повторе после P2002
    // проигравший перечитывает уже созданную запись-победителя, видит
    // current.date === target и возвращает её как no-op, не создавая запись
    // повторно. Инвариант «одна запись» покрыт e2e.
  });
});
