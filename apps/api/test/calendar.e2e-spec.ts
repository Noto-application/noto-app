import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { z } from 'zod';
import type { ApiError, PageResponse } from '@noto/shared';
import {
  apiErrorSchema,
  authUserResponseSchema,
  pageResponseSchema,
  pageSchema,
} from '@noto/shared';

import { createTestApp, resetAuthState } from './helpers/test-app';

/**
 * E2E Календарь страниц (API) — test-first (ADR-013), контракт из спеки
 * apps/api/src/calendar/calendar.spec.md и ADR-011.
 *
 * Тесты красные до реализации (CalendarController/Service + Prisma-модель
 * CalendarEntry): пока эндпоинтов нет, ответы 404. У календаря ещё нет
 * production-символов для импорта, поэтому здесь только публичные HTTP-пути и
 * прямые записи в уже существующие модели Prisma — без импорта несуществующих
 * схем/контрактов.
 *
 * Внутренняя механика атомарности (транзакция/лок/уникальный индекс) не
 * предписывается спекой и здесь не тестируется — только наблюдаемое поведение.
 */

type Role = 'owner' | 'editor' | 'viewer';
type TestAgent = ReturnType<typeof request.agent>;

/** Локальные схемы ответов календаря (в @noto/shared их ещё нет). */
const calendarEntrySchema = z.object({
  pageId: z.string(),
  projectId: z.string(),
  title: z.string(),
  date: z.string(),
  updatedAt: z.string(),
});
const calendarEntriesResponseSchema = z.object({ entries: z.array(calendarEntrySchema) });
const calendarEntryResponseSchema = z.object({ entry: calendarEntrySchema.nullable() });
const calendarPageResponseSchema = z.object({
  page: pageSchema,
  entry: calendarEntrySchema.nullable(),
});

const MISSING_ID = '00000000-0000-0000-0000-000000000000';
const RANGE_FROM = '2026-03-01';
const RANGE_TO = '2026-03-31';
const D1 = '2026-03-10';
const D2 = '2026-03-11';

function parseError(body: unknown): ApiError {
  return apiErrorSchema.parse(body);
}

function parseEntryResponse(body: unknown): z.infer<typeof calendarEntryResponseSchema> {
  return calendarEntryResponseSchema.parse(body);
}

function parseEntries(body: unknown): z.infer<typeof calendarEntriesResponseSchema> {
  return calendarEntriesResponseSchema.parse(body);
}

function parseCalendarPage(body: unknown): z.infer<typeof calendarPageResponseSchema> {
  return calendarPageResponseSchema.parse(body);
}

function parsePage(body: unknown): PageResponse {
  return pageResponseSchema.parse(body);
}

/** Сдвиг date-only строки без локальной timezone. */
function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function rangeDays(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`);
  return Math.round(ms / 86_400_000);
}

describe('Calendar (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await resetAuthState(prisma, redis);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Регистрирует пользователя и возвращает агента с auth-cookie + его id. */
  async function registerUser(email: string): Promise<{ agent: TestAgent; userId: string }> {
    const agent = request.agent(server);
    const response = await agent
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

    const { user } = authUserResponseSchema.parse(response.body);
    return { agent, userId: user.id };
  }

  /** Сид проекта с участниками напрямую в БД. */
  async function seedProject(
    members: Array<{ userId: string; role: Role }>,
    options: { deleted?: boolean } = {},
  ): Promise<string> {
    const project = await prisma.project.create({
      data: {
        name: 'Project',
        deletedAt: options.deleted ? new Date() : null,
        members: { create: members.map((m) => ({ userId: m.userId, role: m.role })) },
      },
    });
    return project.id;
  }

  /** Сид страницы напрямую в БД. */
  async function seedPage(options: {
    projectId: string;
    title?: string;
    parentId?: string | null;
    position?: number;
    deleted?: boolean;
  }): Promise<string> {
    const page = await prisma.page.create({
      data: {
        projectId: options.projectId,
        title: options.title ?? 'Page',
        parentId: options.parentId ?? null,
        position: options.position ?? 0,
        content: [],
        deletedAt: options.deleted ? new Date() : null,
      },
    });
    return page.id;
  }

  function createCalendarPage(
    agent: TestAgent,
    projectId: string,
    body: { title: string; date: string; clientRequestId: string },
  ) {
    return agent.post(`/api/projects/${projectId}/calendar-pages`).send(body);
  }

  function listEntries(agent: TestAgent, projectId: string, from: string, to: string) {
    return agent.get(`/api/projects/${projectId}/calendar-entries?from=${from}&to=${to}`);
  }

  function putDate(
    agent: TestAgent,
    projectId: string,
    pageId: string,
    body: { date: string | null; expectedDate: string | null },
  ) {
    return agent.put(`/api/projects/${projectId}/calendar-entries/${pageId}`).send(body);
  }

  /** Сид датированной Page через фактическое публичное API (PUT под тестом). */
  async function seedDatedPage(
    agent: TestAgent,
    projectId: string,
    date: string,
    title = 'Page',
  ): Promise<string> {
    const pageId = await seedPage({ projectId, title });
    await putDate(agent, projectId, pageId, { date, expectedDate: null }).expect(200);
    return pageId;
  }

  describe('GET /api/projects/:projectId/calendar-entries', () => {
    it('без авторизации → 401 UNAUTHORIZED', async () => {
      const { userId } = await registerUser('c-list-noauth@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);

      const response = await request(server).get(
        `/api/projects/${projectId}/calendar-entries?from=${RANGE_FROM}&to=${RANGE_TO}`,
      );
      expect(response.status).toBe(401);
      expect(parseError(response.body).code).toBe('UNAUTHORIZED');
    });

    it('viewer читает список, title выводится из Page → 200', async () => {
      const { userId: ownerId, agent: owner } = await registerUser('c-list-owner@example.com');
      const { userId: viewerId, agent: viewer } = await registerUser('c-list-viewer@example.com');
      const projectId = await seedProject([
        { userId: ownerId, role: 'owner' },
        { userId: viewerId, role: 'viewer' },
      ]);
      const pageId = await seedDatedPage(owner, projectId, D1, 'Derived title');

      const response = await listEntries(viewer, projectId, RANGE_FROM, RANGE_TO).expect(200);
      const { entries } = parseEntries(response.body);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        pageId,
        projectId,
        title: 'Derived title',
        date: D1,
      });
    });

    it('не участник проекта → 403 FORBIDDEN', async () => {
      const { userId: ownerId, agent: owner } = await registerUser('c-list-owner2@example.com');
      const { agent: stranger } = await registerUser('c-list-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
      await seedDatedPage(owner, projectId, D1);

      const response = await listEntries(stranger, projectId, RANGE_FROM, RANGE_TO);
      expect(response.status).toBe(403);
      expect(parseError(response.body).code).toBe('FORBIDDEN');
    });

    it('изоляция по projectId: участник двух проектов видит только записи проекта из пути', async () => {
      const { userId, agent } = await registerUser('c-list-two-projects@example.com');
      const projectA = await seedProject([{ userId, role: 'editor' }]);
      const projectB = await seedProject([{ userId, role: 'editor' }]);
      const pageA = await seedDatedPage(agent, projectA, D1, 'In A');
      const pageB = await seedDatedPage(agent, projectB, D2, 'In B');

      const listedA = await listEntries(agent, projectA, RANGE_FROM, RANGE_TO).expect(200);
      const entriesA = parseEntries(listedA.body).entries;
      expect(entriesA).toHaveLength(1);
      expect(entriesA[0]).toMatchObject({ pageId: pageA, projectId: projectA, date: D1 });

      const listedB = await listEntries(agent, projectB, RANGE_FROM, RANGE_TO).expect(200);
      const entriesB = parseEntries(listedB.body).entries;
      expect(entriesB).toHaveLength(1);
      expect(entriesB[0]).toMatchObject({ pageId: pageB, projectId: projectB, date: D2 });
    });

    it('несуществующий проект → 404 NOT_FOUND', async () => {
      const { agent } = await registerUser('c-list-404@example.com');
      const response = await listEntries(agent, MISSING_ID, RANGE_FROM, RANGE_TO);
      expect(response.status).toBe(404);
      expect(parseError(response.body).code).toBe('NOT_FOUND');
    });

    it('удалённый проект → 404', async () => {
      const { userId, agent } = await registerUser('c-list-delproj@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }], { deleted: true });
      await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(404);
    });

    it('невалидный диапазон: from >= to, кривая и невозможная дата → 400', async () => {
      const { userId, agent } = await registerUser('c-list-badrange@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);

      await listEntries(agent, projectId, RANGE_FROM, RANGE_FROM).expect(400);
      await listEntries(agent, projectId, RANGE_TO, RANGE_FROM).expect(400);
      await listEntries(agent, projectId, 'not-a-date', RANGE_TO).expect(400);
      await listEntries(agent, projectId, '2026-02-30', RANGE_TO).expect(400);

      const response = await listEntries(agent, projectId, '2026-02-30', RANGE_TO).expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('42 дня приняты, 43 дня → 400', async () => {
      const { userId, agent } = await registerUser('c-list-limit@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const day42 = addDays('2026-01-01', 42);
      const day43 = addDays('2026-01-01', 43);

      expect(rangeDays('2026-01-01', day42)).toBe(42);
      await listEntries(agent, projectId, '2026-01-01', day42).expect(200);

      expect(rangeDays('2026-01-01', day43)).toBe(43);
      await listEntries(agent, projectId, '2026-01-01', day43).expect(400);
    });

    it('полуинтервал [from, to): границы и соседние дни', async () => {
      const { agent, userId } = await registerUser('c-list-bounds@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      await seedDatedPage(agent, projectId, addDays(RANGE_FROM, -1), 'before');
      await seedDatedPage(agent, projectId, RANGE_FROM, 'at-from');
      await seedDatedPage(agent, projectId, addDays(RANGE_TO, -1), 'before-to');
      await seedDatedPage(agent, projectId, RANGE_TO, 'at-to');

      const response = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      const dates = parseEntries(response.body)
        .entries.map((entry) => entry.date)
        .sort();
      expect(dates).toEqual([RANGE_FROM, addDays(RANGE_TO, -1)].sort());
    });

    it('не возвращает soft-deleted Page', async () => {
      const { userId, agent } = await registerUser('c-list-deleted@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const alive = await seedDatedPage(agent, projectId, D1, 'Alive');
      const gone = await seedDatedPage(agent, projectId, D2, 'Gone');

      await agent.delete(`/api/pages/${gone}`).expect(204);

      const response = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      expect(parseEntries(response.body).entries.map((entry) => entry.pageId)).toEqual([alive]);
    });

    it('не возвращает потомка под удалённым предком', async () => {
      const { userId, agent } = await registerUser('c-list-subtree@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const parentId = await seedPage({ projectId, title: 'Parent' });
      const childId = await seedPage({ projectId, title: 'Child', parentId });
      await putDate(agent, projectId, parentId, { date: D1, expectedDate: null }).expect(200);
      await putDate(agent, projectId, childId, { date: D2, expectedDate: null }).expect(200);

      await agent.delete(`/api/pages/${parentId}`).expect(204);

      const response = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      expect(parseEntries(response.body).entries).toEqual([]);
    });

    it('Page снова видна после существующего восстановления lifecycle, запись не пересоздаётся', async () => {
      const { userId, agent } = await registerUser('c-list-restore@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedDatedPage(agent, projectId, D1, 'Restorable');

      const before = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      const [original] = parseEntries(before.body).entries;
      expect(original).toMatchObject({ pageId, date: D1 });

      await agent.delete(`/api/pages/${pageId}`).expect(204);
      const hidden = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      expect(parseEntries(hidden.body).entries).toEqual([]);

      // Существующий lifecycle (восстановление #128) возвращает Page той же
      // записью; календарь запись не пересоздаёт и не меняет её метаданные.
      await prisma.page.update({ where: { id: pageId }, data: { deletedAt: null } });

      const response = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      const { entries } = parseEntries(response.body);
      expect(entries).toHaveLength(1);
      expect(entries[0].pageId).toBe(original.pageId);
      expect(entries[0].date).toBe(original.date);
      expect(entries[0].updatedAt).toBe(original.updatedAt);
    });

    it('переименование Page отражается в последующем GET', async () => {
      const { userId, agent } = await registerUser('c-rename@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedDatedPage(agent, projectId, D1, 'Old title');

      await agent.patch(`/api/pages/${pageId}`).send({ title: 'New title' }).expect(200);

      const response = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      const { entries } = parseEntries(response.body);
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe('New title');
    });
  });

  describe('POST /api/projects/:projectId/calendar-pages', () => {
    it('без авторизации → 401', async () => {
      const { userId } = await registerUser('c-create-noauth@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      const response = await request(server)
        .post(`/api/projects/${projectId}/calendar-pages`)
        .send({ title: 'New', date: D1, clientRequestId: randomUUID() });
      expect(response.status).toBe(401);
    });

    it('editor создаёт корневую Page с датой → 201 { page, entry }', async () => {
      const { userId, agent } = await registerUser('c-create-editor@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      const response = await createCalendarPage(agent, projectId, {
        title: 'Scheduled',
        date: D1,
        clientRequestId: randomUUID(),
      }).expect(201);

      const { page, entry } = parseCalendarPage(response.body);
      expect(page.title).toBe('Scheduled');
      expect(page.projectId).toBe(projectId);
      expect(page.parentId).toBeNull();
      expect(entry).toMatchObject({
        pageId: page.id,
        projectId,
        title: 'Scheduled',
        date: D1,
      });
    });

    it('owner создаёт → 201', async () => {
      const { userId, agent } = await registerUser('c-create-owner@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);

      const response = await createCalendarPage(agent, projectId, {
        title: 'Owned',
        date: D1,
        clientRequestId: randomUUID(),
      }).expect(201);
      expect(parseCalendarPage(response.body).entry?.date).toBe(D1);
    });

    it('viewer → 403', async () => {
      const { userId, agent } = await registerUser('c-create-viewer@example.com');
      const projectId = await seedProject([{ userId, role: 'viewer' }]);

      await createCalendarPage(agent, projectId, {
        title: 'Nope',
        date: D1,
        clientRequestId: randomUUID(),
      }).expect(403);
    });

    it('не участник → 403 без приватных данных', async () => {
      const { userId: ownerId } = await registerUser('c-create-owner2@example.com');
      const { agent: stranger } = await registerUser('c-create-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);

      const response = await createCalendarPage(stranger, projectId, {
        title: 'Nope',
        date: D1,
        clientRequestId: randomUUID(),
      });
      expect(response.status).toBe(403);
      expect(parseError(response.body).code).toBe('FORBIDDEN');
    });

    it('несуществующий проект → 404', async () => {
      const { agent } = await registerUser('c-create-404@example.com');
      await createCalendarPage(agent, MISSING_ID, {
        title: 'Nope',
        date: D1,
        clientRequestId: randomUUID(),
      }).expect(404);
    });

    it('атомарный наблюдаемый результат: Page и запись видны вместе, без дубля', async () => {
      const { userId, agent } = await registerUser('c-create-atomic@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      const response = await createCalendarPage(agent, projectId, {
        title: 'Atomic',
        date: D1,
        clientRequestId: randomUUID(),
      }).expect(201);
      const { page } = parseCalendarPage(response.body);

      const pageResponse = await agent.get(`/api/pages/${page.id}`).expect(200);
      expect(parsePage(pageResponse.body).page.id).toBe(page.id);

      const listed = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      const matching = parseEntries(listed.body).entries.filter(
        (entry) => entry.pageId === page.id,
      );
      expect(matching).toHaveLength(1);
    });

    it('конкурентный одинаковый create (Promise.all) → [200, 201], одна Page и одна запись', async () => {
      const { userId, agent } = await registerUser('c-create-race@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const body = { title: 'Race create', date: D1, clientRequestId: randomUUID() };

      const responses = await Promise.all([
        createCalendarPage(agent, projectId, body),
        createCalendarPage(agent, projectId, body),
      ]);
      const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
      expect(statuses).toEqual([200, 201]);

      const pageIds = responses.map((response) => parseCalendarPage(response.body).page.id);
      expect(new Set(pageIds).size).toBe(1);

      // Считаем Page по проекту, а не только по id ответа: дубль с другой Page
      // id не должен ускользнуть.
      expect(await prisma.page.count({ where: { projectId } })).toBe(1);

      const listed = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      const entries = parseEntries(listed.body).entries;
      expect(entries).toHaveLength(1);
      expect(entries[0].pageId).toBe(pageIds[0]);
    });

    it('date не YYYY-MM-DD или невозможная дата → 400', async () => {
      const { userId, agent } = await registerUser('c-create-baddate@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      await createCalendarPage(agent, projectId, {
        title: 'Bad',
        date: '10-03-2026',
        clientRequestId: randomUUID(),
      }).expect(400);
      const response = await createCalendarPage(agent, projectId, {
        title: 'Bad',
        date: '2026-02-30',
        clientRequestId: randomUUID(),
      }).expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('title пустой/пробельный или длиннее 200 → 400', async () => {
      const { userId, agent } = await registerUser('c-create-badtitle@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      await createCalendarPage(agent, projectId, {
        title: '   ',
        date: D1,
        clientRequestId: randomUUID(),
      }).expect(400);
      await createCalendarPage(agent, projectId, {
        title: 'x'.repeat(201),
        date: D1,
        clientRequestId: randomUUID(),
      }).expect(400);
    });

    it('clientRequestId не UUID → 400', async () => {
      const { userId, agent } = await registerUser('c-create-badkey@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      await createCalendarPage(agent, projectId, {
        title: 'Bad key',
        date: D1,
        clientRequestId: 'not-a-uuid',
      }).expect(400);
    });

    it('replay тем же ключом и payload → 200, тот же ресурс, без дубля', async () => {
      const { userId, agent } = await registerUser('c-create-replay@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const body = { title: 'Idempotent', date: D1, clientRequestId: randomUUID() };

      const first = await createCalendarPage(agent, projectId, body).expect(201);
      const firstPage = parseCalendarPage(first.body).page;

      const replay = await createCalendarPage(agent, projectId, body).expect(200);
      const replayed = parseCalendarPage(replay.body);
      expect(replayed.page.id).toBe(firstPage.id);
      expect(replayed.entry).toMatchObject({ pageId: firstPage.id, date: D1 });

      const listed = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      expect(
        parseEntries(listed.body).entries.filter((entry) => entry.pageId === firstPage.id),
      ).toHaveLength(1);
    });

    it('replay после переименования Page по исходному payload → 200, текущее имя, без отката и дублей', async () => {
      const { userId, agent } = await registerUser('c-create-replay-rename@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const body = { title: 'Before rename', date: D1, clientRequestId: randomUUID() };

      const created = await createCalendarPage(agent, projectId, body).expect(201);
      const pageId = parseCalendarPage(created.body).page.id;

      await agent.patch(`/api/pages/${pageId}`).send({ title: 'After rename' }).expect(200);

      // Исходный payload того же ключа; fingerprint переименование не меняет.
      const replay = await createCalendarPage(agent, projectId, body).expect(200);
      const replayed = parseCalendarPage(replay.body);
      expect(replayed.page.id).toBe(pageId);
      expect(replayed.page.title).toBe('After rename');
      expect(replayed.entry).toMatchObject({ pageId, date: D1, title: 'After rename' });

      const after = await agent.get(`/api/pages/${pageId}`).expect(200);
      expect(parsePage(after.body).page.title).toBe('After rename');

      expect(await prisma.page.count({ where: { projectId } })).toBe(1);

      const listed = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      expect(
        parseEntries(listed.body).entries.filter((entry) => entry.pageId === pageId),
      ).toHaveLength(1);
    });

    it('replay после снятия даты → 200 и entry: null, Page не пересоздаётся', async () => {
      const { userId, agent } = await registerUser('c-create-replay-null@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const body = { title: 'Replay null', date: D1, clientRequestId: randomUUID() };

      const created = await createCalendarPage(agent, projectId, body).expect(201);
      const pageId = parseCalendarPage(created.body).page.id;

      await putDate(agent, projectId, pageId, { date: null, expectedDate: D1 }).expect(200);

      const replay = await createCalendarPage(agent, projectId, body).expect(200);
      const replayed = parseCalendarPage(replay.body);
      expect(replayed.page.id).toBe(pageId);
      expect(replayed.entry).toBeNull();
    });

    it('normalization replay: title, отличающийся только краевыми пробелами, — тот же payload → 200', async () => {
      const { userId, agent } = await registerUser('c-create-replay-trim@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const clientRequestId = randomUUID();

      const created = await createCalendarPage(agent, projectId, {
        title: 'Trim me',
        date: D1,
        clientRequestId,
      }).expect(201);
      const pageId = parseCalendarPage(created.body).page.id;

      const replay = await createCalendarPage(agent, projectId, {
        title: '  Trim me  ',
        date: D1,
        clientRequestId,
      }).expect(200);
      expect(parseCalendarPage(replay.body).page.id).toBe(pageId);
    });

    it('ключ идемпотентности скоупится по проекту: тот же clientRequestId в другом проекте → независимый 201', async () => {
      const { userId, agent } = await registerUser('c-create-scope-project@example.com');
      const projectA = await seedProject([{ userId, role: 'editor' }]);
      const projectB = await seedProject([{ userId, role: 'editor' }]);
      const clientRequestId = randomUUID();
      const body = { title: 'Shared key', date: D1, clientRequestId };

      const createdA = await createCalendarPage(agent, projectA, body).expect(201);
      const createdB = await createCalendarPage(agent, projectB, body).expect(201);

      const pageA = parseCalendarPage(createdA.body).page;
      const pageB = parseCalendarPage(createdB.body).page;
      expect(pageA.projectId).toBe(projectA);
      expect(pageB.projectId).toBe(projectB);
      expect(pageB.id).not.toBe(pageA.id);
    });

    it('тот же ключ в одном проекте у другого editor → replay 200, та же Page', async () => {
      const { userId: firstUserId, agent: firstEditor } = await registerUser(
        'c-create-scope-user1@example.com',
      );
      const { userId: secondUserId, agent: secondEditor } = await registerUser(
        'c-create-scope-user2@example.com',
      );
      const projectId = await seedProject([
        { userId: firstUserId, role: 'editor' },
        { userId: secondUserId, role: 'editor' },
      ]);
      const clientRequestId = randomUUID();
      const body = { title: 'Across users', date: D1, clientRequestId };

      const created = await createCalendarPage(firstEditor, projectId, body).expect(201);
      const pageId = parseCalendarPage(created.body).page.id;

      const replay = await createCalendarPage(secondEditor, projectId, body).expect(200);
      expect(parseCalendarPage(replay.body).page.id).toBe(pageId);
    });

    it('тот же ключ, изменился только title (date тот же) → 409 CONFLICT', async () => {
      const { userId, agent } = await registerUser('c-create-conflict-title@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const clientRequestId = randomUUID();

      await createCalendarPage(agent, projectId, {
        title: 'First',
        date: D1,
        clientRequestId,
      }).expect(201);
      const response = await createCalendarPage(agent, projectId, {
        title: 'Second',
        date: D1,
        clientRequestId,
      });
      expect(response.status).toBe(409);
      expect(parseError(response.body).code).toBe('CONFLICT');
    });

    it('тот же ключ, изменилась только date (title тот же) → 409 CONFLICT', async () => {
      const { userId, agent } = await registerUser('c-create-conflict-date@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const clientRequestId = randomUUID();

      await createCalendarPage(agent, projectId, {
        title: 'First',
        date: D1,
        clientRequestId,
      }).expect(201);
      const response = await createCalendarPage(agent, projectId, {
        title: 'First',
        date: D2,
        clientRequestId,
      });
      expect(response.status).toBe(409);
      expect(parseError(response.body).code).toBe('CONFLICT');
    });

    it('replay перепроверяет ACL: потеря членства → 403', async () => {
      const { userId, agent } = await registerUser('c-create-recheck@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const body = { title: 'Recheck', date: D1, clientRequestId: randomUUID() };

      await createCalendarPage(agent, projectId, body).expect(201);
      await prisma.projectMember.deleteMany({ where: { projectId, userId } });

      await createCalendarPage(agent, projectId, body).expect(403);
    });

    it('replay удалённого проекта → 404, без возврата ресурса', async () => {
      const { userId, agent } = await registerUser('c-create-replay-del@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const body = { title: 'Gone', date: D1, clientRequestId: randomUUID() };

      await createCalendarPage(agent, projectId, body).expect(201);
      await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });

      await createCalendarPage(agent, projectId, body).expect(404);
    });
  });

  describe('PUT /api/projects/:projectId/calendar-entries/:pageId', () => {
    it('без авторизации → 401', async () => {
      const { userId } = await registerUser('c-put-noauth@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });

      const response = await request(server)
        .put(`/api/projects/${projectId}/calendar-entries/${pageId}`)
        .send({ date: D1, expectedDate: null });
      expect(response.status).toBe(401);
    });

    it('editor назначает дату → 200 { entry }', async () => {
      const { userId, agent } = await registerUser('c-put-editor@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId, title: 'Assign me' });

      const response = await putDate(agent, projectId, pageId, {
        date: D1,
        expectedDate: null,
      }).expect(200);
      expect(parseEntryResponse(response.body).entry).toMatchObject({
        pageId,
        projectId,
        date: D1,
      });
    });

    it('owner назначает дату → 200', async () => {
      const { userId, agent } = await registerUser('c-put-owner@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const pageId = await seedPage({ projectId });

      const response = await putDate(agent, projectId, pageId, {
        date: D1,
        expectedDate: null,
      }).expect(200);
      expect(parseEntryResponse(response.body).entry?.date).toBe(D1);
    });

    it('viewer → 403', async () => {
      const { userId, agent } = await registerUser('c-put-viewer@example.com');
      const projectId = await seedProject([{ userId, role: 'viewer' }]);
      const pageId = await seedPage({ projectId });

      await putDate(agent, projectId, pageId, { date: D1, expectedDate: null }).expect(403);
    });

    it('pageId другого проекта → 404, перепривязки нет', async () => {
      const { userId, agent } = await registerUser('c-put-cross@example.com');
      const projectA = await seedProject([{ userId, role: 'editor' }]);
      const projectB = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId: projectA });

      await putDate(agent, projectB, pageId, { date: D1, expectedDate: null }).expect(404);

      const listed = await listEntries(agent, projectB, RANGE_FROM, RANGE_TO).expect(200);
      expect(parseEntries(listed.body).entries).toEqual([]);
    });

    it('меняет дату (CAS успех) → 200, у Page одна запись', async () => {
      const { userId, agent } = await registerUser('c-put-change@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });
      await putDate(agent, projectId, pageId, { date: D1, expectedDate: null }).expect(200);

      const response = await putDate(agent, projectId, pageId, {
        date: D2,
        expectedDate: D1,
      }).expect(200);
      expect(parseEntryResponse(response.body).entry).toMatchObject({ pageId, date: D2 });

      const listed = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      expect(
        parseEntries(listed.body).entries.filter((entry) => entry.pageId === pageId),
      ).toHaveLength(1);
    });

    it('снимает дату → entry: null, Page сохраняется', async () => {
      const { userId, agent } = await registerUser('c-put-remove@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });
      await putDate(agent, projectId, pageId, { date: D1, expectedDate: null }).expect(200);

      const response = await putDate(agent, projectId, pageId, {
        date: null,
        expectedDate: D1,
      }).expect(200);
      expect(parseEntryResponse(response.body).entry).toBeNull();

      await agent.get(`/api/pages/${pageId}`).expect(200);

      const listed = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      expect(parseEntries(listed.body).entries).toEqual([]);
    });

    it('CAS mismatch → 409 CONFLICT', async () => {
      const { userId, agent } = await registerUser('c-put-cas@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });
      await putDate(agent, projectId, pageId, { date: D1, expectedDate: null }).expect(200);

      // Текущая дата D1, но expectedDate и target не совпадают ни с ней: CAS mismatch.
      const conflict = await putDate(agent, projectId, pageId, {
        date: D2,
        expectedDate: '2026-04-01',
      });
      expect(conflict.status).toBe(409);
      expect(parseError(conflict.body).code).toBe('CONFLICT');
    });

    it('идемпотентность: текущая дата == date → 200', async () => {
      const { userId, agent } = await registerUser('c-put-idem@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });
      await putDate(agent, projectId, pageId, { date: D1, expectedDate: null }).expect(200);

      const response = await putDate(agent, projectId, pageId, {
        date: D1,
        expectedDate: D1,
      }).expect(200);
      expect(parseEntryResponse(response.body).entry).toMatchObject({ pageId, date: D1 });
    });

    it('идемпотентное снятие: date null без записи → 200 entry: null', async () => {
      const { userId, agent } = await registerUser('c-put-idem-null@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });

      const response = await putDate(agent, projectId, pageId, {
        date: null,
        expectedDate: null,
      }).expect(200);
      expect(parseEntryResponse(response.body).entry).toBeNull();
    });

    it('desired-state replay: текущая дата == date при stale expectedDate → 200, без 409', async () => {
      const { userId, agent } = await registerUser('c-put-stale@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedDatedPage(agent, projectId, D1);

      await putDate(agent, projectId, pageId, { date: D2, expectedDate: D1 }).expect(200);

      // Тот же запрос повторно: expectedDate устарел, но текущая дата уже D2,
      // значит это no-op, а не CAS mismatch.
      const replay = await putDate(agent, projectId, pageId, { date: D2, expectedDate: D1 }).expect(
        200,
      );
      expect(parseEntryResponse(replay.body).entry).toMatchObject({ pageId, date: D2 });
    });

    it('replay снятия: повтор { date: null, expectedDate: D1 } после снятия → 200, entry: null, Page жива', async () => {
      const { userId, agent } = await registerUser('c-put-remove-replay@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedDatedPage(agent, projectId, D1);

      await putDate(agent, projectId, pageId, { date: null, expectedDate: D1 }).expect(200);

      const replay = await putDate(agent, projectId, pageId, {
        date: null,
        expectedDate: D1,
      }).expect(200);
      expect(parseEntryResponse(replay.body).entry).toBeNull();

      await agent.get(`/api/pages/${pageId}`).expect(200);
    });

    it('несуществующая/удалённая Page → 404', async () => {
      const { userId, agent } = await registerUser('c-put-404@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const deletedPageId = await seedPage({ projectId, deleted: true });

      await putDate(agent, projectId, MISSING_ID, { date: D1, expectedDate: null }).expect(404);
      await putDate(agent, projectId, deletedPageId, { date: D1, expectedDate: null }).expect(404);
    });

    it('конкурентные PUT при E == C, разных target (оба ≠ C) → один 200, один 409', async () => {
      const { userId, agent } = await registerUser('c-put-race@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });

      // C = null (записи нет), E = null, целевые D1 и D2 оба ≠ C — детерминированно.
      const [first, second] = await Promise.all([
        putDate(agent, projectId, pageId, { date: D1, expectedDate: null }),
        putDate(agent, projectId, pageId, { date: D2, expectedDate: null }),
      ]);
      const statuses = [first.status, second.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);

      const listed = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      expect(
        parseEntries(listed.body).entries.filter((entry) => entry.pageId === pageId),
      ).toHaveLength(1);
    });

    it('конкурентные no-op PUT (текущая дата == target) → оба 200, без дубля', async () => {
      const { userId, agent } = await registerUser('c-put-race-null@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });

      // C = null, E = null, target = null == C: каждый запрос — no-op, порядок не важен.
      const responses = await Promise.all([
        putDate(agent, projectId, pageId, { date: null, expectedDate: null }),
        putDate(agent, projectId, pageId, { date: null, expectedDate: null }),
      ]);
      expect(responses.map((response) => response.status)).toEqual([200, 200]);

      const listed = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      expect(parseEntries(listed.body).entries).toEqual([]);
    });

    it('конкурентный identical desired-state D1→D2 (оба expected D1) → оба 200, одна запись D2', async () => {
      const { userId, agent } = await registerUser('c-put-race-desired@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedDatedPage(agent, projectId, D1);

      // Обычный строгий CAS провалил бы второй запрос (текущая D2 ≠ expected D1);
      // desired-state no-op по «текущая == date» даёт обоим 200.
      const responses = await Promise.all([
        putDate(agent, projectId, pageId, { date: D2, expectedDate: D1 }),
        putDate(agent, projectId, pageId, { date: D2, expectedDate: D1 }),
      ]);
      expect(responses.map((response) => response.status)).toEqual([200, 200]);

      const listed = await listEntries(agent, projectId, RANGE_FROM, RANGE_TO).expect(200);
      const entries = parseEntries(listed.body).entries;
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ pageId, date: D2 });
    });
  });
});
