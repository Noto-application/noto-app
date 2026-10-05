import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import * as Y from 'yjs';
import {
  apiErrorSchema,
  authUserResponseSchema,
  calendarEntriesResponseSchema,
  pageResponseSchema,
} from '@noto/shared';

import { createTestApp, resetAuthState } from './helpers/test-app';

type Role = 'owner' | 'editor' | 'viewer';
type Agent = ReturnType<typeof request.agent>;
const MISSING_ID = '00000000-0000-0000-0000-000000000000';
const DATE = '2026-03-10';

describe('Page trash (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();
  });
  beforeEach(async () => resetAuthState(prisma, redis));
  afterAll(async () => app.close());

  async function user(email: string) {
    const agent = request.agent(server);
    const response = await agent
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return { agent, userId: authUserResponseSchema.parse(response.body).user.id };
  }

  async function project(members: Array<{ userId: string; role: Role }>, deleted = false) {
    const row = await prisma.project.create({
      data: {
        name: 'Project',
        deletedAt: deleted ? new Date() : null,
        members: { create: members },
      },
    });
    return row.id;
  }

  async function page(options: {
    projectId: string;
    parentId?: string | null;
    title?: string;
    position?: number;
    deletedAt?: Date;
    content?: object[];
    editorMode?: 'rest' | 'collab';
    id?: string;
  }) {
    const row = await prisma.page.create({
      data: {
        ...options,
        title: options.title ?? 'Page',
        content: options.content ?? [],
        position: options.position ?? 0,
      },
    });
    return row.id;
  }

  const list = (agent: Agent, projectId: string, query = '') =>
    agent.get(`/api/projects/${projectId}/trash/pages${query}`);
  const restore = (agent: Agent, pageId: string) => agent.post(`/api/pages/${pageId}/restore`);
  const error = (body: unknown, code: string) => {
    expect([
      ['code', 'message'],
      ['code', 'details', 'message'],
    ]).toContainEqual(Object.keys(body as object).sort());
    expect(apiErrorSchema.parse(body).code).toBe(code);
  };

  function trash(body: unknown): {
    pages: Array<{
      id: string;
      projectId: string;
      parentId: string | null;
      title: string;
      position: number;
      deletedAt: string;
    }>;
    nextCursor: string | null;
  } {
    expect(body).not.toBeNull();
    expect(typeof body).toBe('object');
    expect(Object.keys(body as object).sort()).toEqual(['nextCursor', 'pages']);
    expect(Array.isArray((body as { pages: unknown }).pages)).toBe(true);
    for (const item of (body as { pages: unknown[] }).pages) {
      expect(item).not.toBeNull();
      expect(typeof item).toBe('object');
      expect(Object.keys(item as object).sort()).toEqual([
        'deletedAt',
        'id',
        'parentId',
        'position',
        'projectId',
        'title',
      ]);
      const row = item as {
        id: unknown;
        projectId: unknown;
        parentId: unknown;
        title: unknown;
        position: unknown;
        deletedAt: unknown;
      };
      expect(typeof row.id).toBe('string');
      expect(typeof row.projectId).toBe('string');
      expect(typeof row.title).toBe('string');
      expect(typeof row.position).toBe('number');
      expect(typeof row.deletedAt).toBe('string');
      expect([null, 'string']).toContain(row.parentId === null ? null : typeof row.parentId);
      expect(Number.isInteger((item as { position: number }).position)).toBe(true);
      expect(Number.isNaN(Date.parse((item as { deletedAt: string }).deletedAt))).toBe(false);
    }
    expect([null, 'string']).toContain(
      (body as { nextCursor: unknown }).nextCursor === null
        ? null
        : typeof (body as { nextCursor: unknown }).nextCursor,
    );
    return body as ReturnType<typeof trash>;
  }

  describe('GET /api/projects/:projectId/trash/pages', () => {
    it('requires auth, viewer membership and a live project', async () => {
      const owner = await user('trash-owner@example.com');
      const outsider = await user('trash-outsider@example.com');
      const viewer = await user('trash-viewer@example.com');
      const id = await project([
        { userId: owner.userId, role: 'owner' },
        { userId: viewer.userId, role: 'viewer' },
      ]);
      error(
        (await request(server).get(`/api/projects/${id}/trash/pages`).expect(401)).body,
        'UNAUTHORIZED',
      );
      error((await list(outsider.agent, id).expect(403)).body, 'FORBIDDEN');
      expect(trash((await list(viewer.agent, id).expect(200)).body)).toEqual({
        pages: [],
        nextCursor: null,
      });
      error((await list(owner.agent, MISSING_ID).expect(404)).body, 'NOT_FOUND');
      const removed = await project([{ userId: owner.userId, role: 'owner' }], true);
      error((await list(owner.agent, removed).expect(404)).body, 'NOT_FOUND');
    });

    it('lists every deleted descendant flat, including separately deleted children, without leaking another project or content', async () => {
      const { agent, userId } = await user('trash-flat@example.com');
      const a = await project([{ userId, role: 'viewer' }]);
      const b = await project([{ userId, role: 'viewer' }]);
      const root = await page({ projectId: a, title: 'Root' });
      const child = await page({ projectId: a, parentId: root, title: 'Child' });
      const grandchild = await page({ projectId: a, parentId: child, title: 'Grandchild' });
      const separatelyDeleted = await page({ projectId: a, title: 'Earlier' });
      await page({ projectId: a, title: 'Alive' });
      const foreign = await page({
        projectId: b,
        deletedAt: new Date(),
        content: [{ secret: true }],
      });
      await prisma.page.update({
        where: { id: separatelyDeleted },
        data: { deletedAt: new Date('2026-01-01') },
      });
      // Существующий каскад проверяем через HTTP, а не имитируем фикстурой.
      await prisma.projectMember.update({
        where: { projectId_userId: { projectId: a, userId } },
        data: { role: 'editor' },
      });
      await agent.delete(`/api/pages/${root}`).expect(204);

      const pages = trash((await list(agent, a).expect(200)).body).pages;
      expect(new Set(pages.map((item) => item.id))).toEqual(
        new Set([root, child, grandchild, separatelyDeleted]),
      );
      expect(pages.map((item) => item.id)).not.toContain(foreign);
      for (const item of pages) {
        expect(Object.keys(item).sort()).toEqual([
          'deletedAt',
          'id',
          'parentId',
          'position',
          'projectId',
          'title',
        ]);
        expect(item.projectId).toBe(a);
        expect(item.deletedAt).toEqual(expect.any(String));
        expect(Number.isNaN(Date.parse(item.deletedAt))).toBe(false);
      }
      expect(pages.find((item) => item.id === grandchild)?.parentId).toBe(child);
      expect(trash((await list(agent, b).expect(200)).body).pages.map((item) => item.id)).toEqual([
        foreign,
      ]);
    });

    it('orders equal timestamps by id and paginates by keyset, including a cursor from another project', async () => {
      const { agent, userId } = await user('trash-cursor@example.com');
      const id = await project([{ userId, role: 'viewer' }]);
      const other = await project([{ userId, role: 'viewer' }]);
      const at = new Date('2026-01-01T00:00:00.000Z');
      const ids = [
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ];
      for (const pageId of ids) await page({ id: pageId, projectId: id, deletedAt: at });
      const newest = await page({ projectId: id, deletedAt: new Date('2026-01-02') });
      const oldest = await page({ projectId: id, deletedAt: new Date('2025-12-31') });
      await page({ projectId: other, deletedAt: at });
      await page({ projectId: other, deletedAt: at });
      const full = trash((await list(agent, id).expect(200)).body);
      expect(full.pages.map((item) => item.id)).toEqual([newest, ...ids.sort(), oldest]);
      expect(full.nextCursor).toBeNull();

      const collected: string[] = [];
      let cursor: string | null = null;
      do {
        const result = trash(
          (
            await list(
              agent,
              id,
              `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
            ).expect(200)
          ).body,
        );
        collected.push(...result.pages.map((item) => item.id));
        cursor = result.nextCursor;
        if (cursor !== null) expect(cursor.length).toBeGreaterThan(0);
      } while (cursor !== null && collected.length <= full.pages.length);
      expect(collected).toEqual(full.pages.map((item) => item.id));
      const foreignCursor = trash((await list(agent, other, '?limit=1').expect(200)).body);
      expect(foreignCursor.pages).toHaveLength(1);
      // Курсор другого проекта не должен раскрывать его страницы.
      const foreignPage = await list(
        agent,
        id,
        `?cursor=${encodeURIComponent(foreignCursor.nextCursor ?? '')}`,
      );
      expect(foreignPage.status).toBe(200);
      expect(trash(foreignPage.body).pages.every((item) => item.projectId === id)).toBe(true);
    });

    it('enforces default 50, max 100 and rejects invalid limits/cursors', async () => {
      const { agent, userId } = await user('trash-limits@example.com');
      const id = await project([{ userId, role: 'viewer' }]);
      for (let i = 0; i < 51; i += 1)
        await page({ projectId: id, deletedAt: new Date('2026-01-01') });
      const first = trash((await list(agent, id).expect(200)).body);
      expect(first.pages).toHaveLength(50);
      expect(first.nextCursor).toEqual(expect.any(String));
      expect(trash((await list(agent, id, '?limit=100').expect(200)).body).pages).toHaveLength(51);
      for (const query of [
        '?limit=0',
        '?limit=101',
        '?limit=abc',
        '?limit=1.5',
        '?cursor=broken',
      ]) {
        error((await list(agent, id, query).expect(400)).body, 'VALIDATION_ERROR');
      }
    });
  });

  describe('POST /api/pages/:pageId/restore', () => {
    it('checks auth, deleted-aware existence, live project and editor access', async () => {
      const owner = await user('restore-owner@example.com');
      const viewer = await user('restore-viewer@example.com');
      const outsider = await user('restore-outsider@example.com');
      const id = await project([
        { userId: owner.userId, role: 'owner' },
        { userId: viewer.userId, role: 'viewer' },
      ]);
      const deleted = await page({ projectId: id, deletedAt: new Date() });
      const alive = await page({ projectId: id });
      error(
        (await request(server).post(`/api/pages/${deleted}/restore`).expect(401)).body,
        'UNAUTHORIZED',
      );
      error((await restore(owner.agent, MISSING_ID).expect(404)).body, 'NOT_FOUND');
      error((await restore(owner.agent, alive).expect(404)).body, 'NOT_FOUND');
      error((await restore(viewer.agent, deleted).expect(403)).body, 'FORBIDDEN');
      error((await restore(outsider.agent, deleted).expect(403)).body, 'FORBIDDEN');
      const otherProject = await project([{ userId: outsider.userId, role: 'editor' }]);
      expect(otherProject).not.toBe(id);
      error((await restore(outsider.agent, deleted).expect(403)).body, 'FORBIDDEN');
      expect(
        (await prisma.page.findUniqueOrThrow({ where: { id: deleted } })).deletedAt,
      ).not.toBeNull();
      const removed = await project([{ userId: owner.userId, role: 'owner' }], true);
      const inRemoved = await page({ projectId: removed, deletedAt: new Date() });
      error((await restore(owner.agent, inRemoved).expect(404)).body, 'NOT_FOUND');
    });

    it('allows an owner to restore a deleted page', async () => {
      const { agent, userId } = await user('restore-owner-success@example.com');
      const id = await project([{ userId, role: 'owner' }]);
      const target = await page({ projectId: id, deletedAt: new Date() });
      expect(
        pageResponseSchema.parse((await restore(agent, target).expect(200)).body).page.id,
      ).toBe(target);
      expect((await prisma.page.findUniqueOrThrow({ where: { id: target } })).deletedAt).toBeNull();
    });

    it('preserves REST content on restore', async () => {
      const { agent, userId } = await user('restore-rest-content@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const content = [{ type: 'paragraph', content: 'Keep this text' }];
      const target = await page({ projectId: id, content, deletedAt: new Date() });
      const restored = pageResponseSchema.parse(
        (await restore(agent, target).expect(200)).body,
      ).page;
      expect(restored).toMatchObject({ id: target, editorMode: 'rest', content });
      expect((await prisma.page.findUniqueOrThrow({ where: { id: target } })).content).toEqual(
        content,
      );
    });

    it('restores a separately deleted child after its parent is restored', async () => {
      const { agent, userId } = await user('restore-separate-child@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const parent = await page({ projectId: id });
      const child = await page({ projectId: id, parentId: parent });
      await agent.delete(`/api/pages/${child}`).expect(204);
      await agent.delete(`/api/pages/${parent}`).expect(204);
      expect(
        (await prisma.page.findUniqueOrThrow({ where: { id: child } })).deletedAt,
      ).not.toBeNull();
      await restore(agent, parent).expect(200);
      expect(
        pageResponseSchema.parse((await restore(agent, child).expect(200)).body).page,
      ).toMatchObject({
        id: child,
        parentId: parent,
      });
      expect((await prisma.page.findUniqueOrThrow({ where: { id: child } })).deletedAt).toBeNull();
    });

    it('restores only one page at the end of its original sibling group, preserving content, collab state and calendar entry', async () => {
      const { agent, userId } = await user('restore-preserve@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const parent = await page({ projectId: id });
      const target = await page({
        projectId: id,
        parentId: parent,
        position: 0,
        title: 'Original',
        content: [{ type: 'paragraph' }],
        editorMode: 'collab',
      });
      const child = await page({ projectId: id, parentId: target });
      await page({ projectId: id, parentId: parent, position: 4 });
      const doc = new Y.Doc();
      doc.getText('body').insert(0, 'Preserved');
      const state = Buffer.from(Y.encodeStateAsUpdate(doc));
      await prisma.pageCollabState.create({ data: { pageId: target, state, version: 7 } });
      await prisma.calendarEntry.create({ data: { pageId: target, date: DATE } });
      await agent.delete(`/api/pages/${target}`).expect(204);
      const before = await prisma.calendarEntry.findUniqueOrThrow({ where: { pageId: target } });
      const restored = pageResponseSchema.parse(
        (await restore(agent, target).expect(200)).body,
      ).page;
      expect(restored).toMatchObject({
        id: target,
        projectId: id,
        parentId: parent,
        title: 'Original',
        editorMode: 'collab',
        content: [{ type: 'paragraph' }],
        position: 5,
      });
      expect((await prisma.page.findUniqueOrThrow({ where: { id: target } })).deletedAt).toBeNull();
      expect(
        (await prisma.page.findUniqueOrThrow({ where: { id: child } })).deletedAt,
      ).not.toBeNull();
      expect(
        await prisma.pageCollabState.findUniqueOrThrow({ where: { pageId: target } }),
      ).toMatchObject({ state, version: 7 });
      expect(await prisma.calendarEntry.findUniqueOrThrow({ where: { pageId: target } })).toEqual(
        before,
      );
      const entries = calendarEntriesResponseSchema.parse(
        (
          await agent
            .get(`/api/projects/${id}/calendar-entries?from=2026-03-01&to=2026-04-01`)
            .expect(200)
        ).body,
      ).entries;
      expect(entries.map((entry) => entry.pageId)).toContain(target);
      error((await restore(agent, target).expect(404)).body, 'NOT_FOUND');
    });

    it('appends a root page and refuses deleted ancestors without changing the target', async () => {
      const { agent, userId } = await user('restore-ancestor@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const root = await page({ projectId: id, position: 0 });
      const removedRoot = await page({ projectId: id, position: 0, deletedAt: new Date() });
      const child = await page({ projectId: id, parentId: removedRoot, deletedAt: new Date() });
      const grandchild = await page({ projectId: id, parentId: child, deletedAt: new Date() });
      error((await restore(agent, grandchild).expect(409)).body, 'CONFLICT');
      expect(
        (await prisma.page.findUniqueOrThrow({ where: { id: grandchild } })).deletedAt,
      ).not.toBeNull();
      const restored = pageResponseSchema.parse(
        (await restore(agent, removedRoot).expect(200)).body,
      ).page;
      expect(restored).toMatchObject({ id: removedRoot, parentId: null, position: 1 });
      expect(root).not.toBe(removedRoot);
      expect(
        (await prisma.page.findUniqueOrThrow({ where: { id: child } })).deletedAt,
      ).not.toBeNull();
      expect(
        pageResponseSchema.parse((await restore(agent, child).expect(200)).body).page,
      ).toMatchObject({
        id: child,
        parentId: removedRoot,
      });
      expect(
        (await prisma.page.findUniqueOrThrow({ where: { id: grandchild } })).deletedAt,
      ).not.toBeNull();
    });

    it('rejects depth 11 after a live ancestor moves while the child is deleted', async () => {
      const { agent, userId } = await user('restore-depth@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const parent = await page({ projectId: id });
      const target = await page({ projectId: id, parentId: parent, deletedAt: new Date() });
      let ancestor: string | null = null;
      for (let i = 0; i < 9; i += 1) ancestor = await page({ projectId: id, parentId: ancestor });
      await agent.patch(`/api/pages/${parent}`).send({ parentId: ancestor }).expect(200);
      error((await restore(agent, target).expect(409)).body, 'CONFLICT');
      expect(
        (await prisma.page.findUniqueOrThrow({ where: { id: target } })).deletedAt,
      ).not.toBeNull();
    });

    it('rechecks revoked membership after revocation commits', async () => {
      const { agent, userId } = await user('restore-revoked@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const target = await page({ projectId: id, deletedAt: new Date() });
      await prisma.projectMember.delete({ where: { projectId_userId: { projectId: id, userId } } });
      error((await restore(agent, target).expect(403)).body, 'FORBIDDEN');
      expect(
        (await prisma.page.findUniqueOrThrow({ where: { id: target } })).deletedAt,
      ).not.toBeNull();
    });

    it('preserves parentId (I2): moving a live parent under its child is 404 while deleted, 400 (cycle) once restored', async () => {
      const { agent, userId } = await user('restore-move-cycle@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const parent = await page({ projectId: id });
      const target = await page({ projectId: id, parentId: parent, deletedAt: new Date() });

      // Детерминированная последовательность, а не гонка: restore не меняет
      // parentId (I2), поэтому пересечение restore/move во времени цикла не
      // создаёт. Проверяем оба состояния цели явно.
      // Пока цель в корзине, живого родителя для move нет → 404.
      error(
        (await agent.patch(`/api/pages/${parent}`).send({ parentId: target }).expect(404)).body,
        'NOT_FOUND',
      );
      const parentBefore = await prisma.page.findUniqueOrThrow({ where: { id: parent } });
      const targetBefore = await prisma.page.findUniqueOrThrow({ where: { id: target } });
      expect(parentBefore.parentId).toBeNull();
      expect(targetBefore.parentId).toBe(parent);
      expect(targetBefore.deletedAt).not.toBeNull();

      // Restore не трогает parentId — цель остаётся ребёнком parent.
      await restore(agent, target).expect(200);
      expect((await prisma.page.findUniqueOrThrow({ where: { id: target } })).parentId).toBe(
        parent,
      );

      // Теперь цель жива: перенос parent под собственного потомка — цикл → 400.
      error(
        (await agent.patch(`/api/pages/${parent}`).send({ parentId: target }).expect(400)).body,
        'VALIDATION_ERROR',
      );
      const parentAfter = await prisma.page.findUniqueOrThrow({ where: { id: parent } });
      const targetAfter = await prisma.page.findUniqueOrThrow({ where: { id: target } });
      expect(parentAfter.parentId).toBeNull();
      expect(targetAfter.parentId).toBe(parent);
      expect(targetAfter.deletedAt).toBeNull();
    });
  });

  describe('concurrent HTTP operations on PostgreSQL', () => {
    it.each(['append', 'explicit'] as const)(
      'create (%s) blocked at INSERT while parent delete commits returns 404 without a live orphan',
      async (mode) => {
        const { agent, userId } = await user(`race-create-${mode}@example.com`);
        const id = await project([{ userId, role: 'editor' }]);
        const parent = await page({ projectId: id });
        const title = `Racing child ${mode} ${randomUUID()}`;
        const lockKey = mode === 'append' ? 156001n : 156002n;
        const functionName = `trash_insert_gate_${mode}`;
        const triggerName = `trash_insert_gate_${mode}`;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let holder: Promise<void> | undefined;
        let createRequest: Promise<request.Response> | undefined;
        let installed = false;
        try {
          await prisma.$executeRawUnsafe(`
            CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW.title = TG_ARGV[0] THEN
                PERFORM pg_advisory_xact_lock(TG_ARGV[1]::bigint);
              END IF;
              RETURN NEW;
            END $$
          `);
          installed = true;
          await prisma.$executeRawUnsafe(`
            CREATE TRIGGER ${triggerName} BEFORE INSERT ON pages
            FOR EACH ROW EXECUTE FUNCTION ${functionName}('${title}', '${lockKey}')
          `);
          let holderPid: number | undefined;
          holder = prisma.$transaction(
            async (tx) => {
              const [row] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
              holderPid = row.pid;
              await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey})::text`;
              await gate;
            },
            { timeout: 40000 },
          );
          void holder.catch(() => undefined);
          // Ожидание условия, а не фиксированная пауза: запрос не стартует, пока lock не взят.
          const holderUntil = Date.now() + 12000;
          while (
            holderPid === undefined ||
            !(
              await prisma.$queryRaw<{ locked: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_locks
              WHERE pid = ${holderPid ?? -1} AND locktype = 'advisory' AND granted
            ) AS locked
          `
            )[0].locked
          ) {
            if (Date.now() > holderUntil) throw new Error('Advisory lock holder did not start');
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          createRequest = agent
            .post(`/api/projects/${id}/pages`)
            .send({
              title,
              parentId: parent,
              ...(mode === 'explicit' ? { position: 0 } : {}),
            })
            .timeout({ deadline: 25000 })
            .then((response) => response);
          void createRequest.catch(() => undefined);
          const blockedUntil = Date.now() + 12000;
          let blocked = false;
          while (!blocked) {
            const [row] = await prisma.$queryRaw<{ blocked: boolean }[]>`
              SELECT EXISTS (
                SELECT 1 FROM pg_stat_activity a
                WHERE a.pid <> pg_backend_pid()
                  AND a.wait_event_type = 'Lock'
                  AND a.query ILIKE '%INSERT INTO%pages%'
                  AND ${holderPid} = ANY(pg_blocking_pids(a.pid))
              ) AS blocked
            `;
            blocked = row.blocked;
            if (!blocked) {
              if (Date.now() > blockedUntil)
                throw new Error('Create never blocked at pages INSERT');
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
          }
          await agent.delete(`/api/pages/${parent}`).expect(204);
          release();
          await holder;
          const created = await createRequest;
          expect(created.status).toBe(404);
          error(created.body, 'NOT_FOUND');
          expect(
            (await prisma.page.findUniqueOrThrow({ where: { id: parent } })).deletedAt,
          ).not.toBeNull();
          expect(
            await prisma.page.findMany({ where: { projectId: id, parentId: parent } }),
          ).toEqual([]);
        } finally {
          release();
          await Promise.allSettled([holder, createRequest].filter((p) => p !== undefined));
          await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON pages`);
          if (installed) await prisma.$executeRawUnsafe(`DROP FUNCTION ${functionName}()`);
        }
      },
      60000,
    );

    it('two restores have exactly one winner', async () => {
      const { agent, userId } = await user('race-twice@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const target = await page({ projectId: id, deletedAt: new Date() });
      const responses = await Promise.all([restore(agent, target), restore(agent, target)]);
      expect(responses.map((r) => r.status).sort()).toEqual([200, 404]);
      expect((await prisma.page.findUniqueOrThrow({ where: { id: target } })).deletedAt).toBeNull();
    });

    it('restore vs parent delete preserves active-child invariant', async () => {
      const { agent, userId } = await user('race-parent@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const parent = await page({ projectId: id });
      const target = await page({ projectId: id, parentId: parent, deletedAt: new Date() });
      const [restored, removed] = await Promise.all([
        restore(agent, target),
        agent.delete(`/api/pages/${parent}`),
      ]);
      expect([200, 409]).toContain(restored.status);
      expect(removed.status).toBe(204);
      const parentRow = await prisma.page.findUniqueOrThrow({ where: { id: parent } });
      const targetRow = await prisma.page.findUniqueOrThrow({ where: { id: target } });
      expect(parentRow.deletedAt).not.toBeNull();
      expect(targetRow.deletedAt).not.toBeNull();
    });

    it('restore vs delete of the same page has a serializable final state', async () => {
      const { agent, userId } = await user('race-self@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const target = await page({ projectId: id, deletedAt: new Date() });
      const [restored, removed] = await Promise.all([
        restore(agent, target),
        agent.delete(`/api/pages/${target}`),
      ]);
      expect([
        [200, 204],
        [200, 404],
      ]).toContainEqual([restored.status, removed.status]);
      const row = await prisma.page.findUniqueOrThrow({ where: { id: target } });
      expect(row.deletedAt === null).toBe(removed.status === 404);
    });

    it('restore vs parent move to depth 10 serializes without a depth-11 child', async () => {
      const { agent, userId } = await user('race-move@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const parent = await page({ projectId: id });
      const target = await page({ projectId: id, parentId: parent, deletedAt: new Date() });
      let ancestor: string | null = null;
      for (let i = 0; i < 9; i += 1) ancestor = await page({ projectId: id, parentId: ancestor });
      const [restored, moved] = await Promise.all([
        restore(agent, target),
        agent.patch(`/api/pages/${parent}`).send({ parentId: ancestor }),
      ]);
      expect([
        [200, 400],
        [409, 200],
      ]).toContainEqual([restored.status, moved.status]);
      const parentRow = await prisma.page.findUniqueOrThrow({ where: { id: parent } });
      const targetRow = await prisma.page.findUniqueOrThrow({ where: { id: target } });
      expect(targetRow.deletedAt === null && parentRow.parentId === ancestor).toBe(false);
    });

    it('overlapping membership revocation and restore has an atomic permitted outcome', async () => {
      const { agent, userId } = await user('race-revoke@example.com');
      const id = await project([{ userId, role: 'editor' }]);
      const target = await page({ projectId: id, deletedAt: new Date() });
      const [restored] = await Promise.all([
        restore(agent, target),
        prisma.projectMember.delete({ where: { projectId_userId: { projectId: id, userId } } }),
      ]);
      expect([200, 403]).toContain(restored.status);
      const row = await prisma.page.findUniqueOrThrow({ where: { id: target } });
      expect(row.deletedAt === null).toBe(restored.status === 200);
    });
  });
});
