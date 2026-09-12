import type { Server } from 'node:http';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { ApiError, AuthCredentials, AuthUserResponse } from '@noto/shared';
import { apiErrorSchema, authUserResponseSchema } from '@noto/shared';

import type { Env } from '../src/config/env.schema';
import { createTestApp, resetAuthState } from './helpers/test-app';

const credentials = {
  email: 'auth-test@example.com',
  password: 'password123',
} satisfies AuthCredentials;

function parseAuthUserBody(body: unknown): AuthUserResponse {
  return authUserResponseSchema.parse(body);
}

function parseApiErrorBody(body: unknown): ApiError {
  return apiErrorSchema.parse(body);
}

function expectNoTokensInBody(body: AuthUserResponse | Record<string, unknown>): void {
  expect(body).not.toHaveProperty('accessToken');
  expect(body).not.toHaveProperty('refreshToken');
  expect(body).not.toHaveProperty('access_token');
  expect(body).not.toHaveProperty('refresh_token');
  expect(JSON.stringify(body)).not.toMatch(/eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/);
}

describe('Auth (e2e)', () => {
  let server: Server;
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];

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

  describe('POST /api/auth/register', () => {
    it('регистрирует пользователя, ставит cookie и не возвращает токены в теле', async () => {
      const agent = request.agent(server);

      const response = await agent
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);

      const body = parseAuthUserBody(response.body);

      expect(body.user).toMatchObject({
        email: credentials.email,
      });
      expect(body.user).not.toHaveProperty('passwordHash');
      expectNoTokensInBody(body);

      const cookieHeader = response.headers['set-cookie'];
      expect(cookieHeader).toEqual(
        expect.arrayContaining([
          expect.stringContaining('access_token='),
          expect.stringContaining('refresh_token='),
          expect.stringMatching(/HttpOnly/i),
        ]),
      );

      const users = await prisma.user.findMany();
      expect(users).toHaveLength(1);
    });

    it('создаёт дефолтный проект с ролью owner для нового пользователя', async () => {
      const agent = request.agent(server);

      const response = await agent.post('/api/auth/register').send(credentials).expect(201);
      const body = parseAuthUserBody(response.body);

      const memberships = await prisma.projectMember.findMany({
        where: { userId: body.user.id },
        include: { project: true },
      });

      expect(memberships).toHaveLength(1);
      expect(memberships[0]?.role).toBe('owner');
      expect(memberships[0]?.project.deletedAt).toBeNull();
    });

    it('возвращает 409 если email занят и не создаёт второго пользователя', async () => {
      const agent = request.agent(server);
      await agent.post('/api/auth/register').send(credentials).expect(201);

      const response = await agent
        .post('/api/auth/register')
        .send(credentials)
        .expect(409);

      expect(parseApiErrorBody(response.body)).toMatchObject({
        code: 'EMAIL_TAKEN',
      });

      expect(await prisma.user.count()).toBe(1);
    });

    it('возвращает 400 при коротком пароле', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({ email: 'short@example.com', password: 'short' })
        .expect(400);

      expect(parseApiErrorBody(response.body).code).toBe('VALIDATION_ERROR');
      expect(await prisma.user.count()).toBe(0);
    });

    it('возвращает 400 при некорректном email', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);

      expect(parseApiErrorBody(response.body).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(server).post('/api/auth/register').send(credentials);
    });

    it('логинит пользователя и ставит cookie без токенов в теле', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);

      const body = parseAuthUserBody(response.body);

      expect(body.user.email).toBe(credentials.email);
      expectNoTokensInBody(body);
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('access_token='),
          expect.stringContaining('refresh_token='),
        ]),
      );
    });

    it('возвращает одинаковый 401 для неверного пароля', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ email: credentials.email, password: 'wrong-password' })
        .expect(401);

      expect(parseApiErrorBody(response.body)).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('возвращает тот же 401 для несуществующего email', async () => {
      const wrongPassword = await request(server)
        .post('/api/auth/login')
        .send({ email: credentials.email, password: 'wrong-password' })
        .expect(401);

      const missingEmail = await request(server)
        .post('/api/auth/login')
        .send({ email: 'missing@example.com', password: 'password123' })
        .expect(401);

      expect(parseApiErrorBody(missingEmail.body)).toEqual(parseApiErrorBody(wrongPassword.body));
    });

    it('возвращает 400 при невалидном теле', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ email: 'bad', password: '123' })
        .expect(400);

      expect(parseApiErrorBody(response.body).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('возвращает 401 без refresh cookie', async () => {
      const response = await request(server).post('/api/auth/refresh').expect(401);

      expect(parseApiErrorBody(response.body).code).toBe('UNAUTHORIZED');
    });

    it('обновляет cookie и не возвращает токены в теле', async () => {
      const agent = request.agent(server);
      await agent.post('/api/auth/register').send(credentials);

      const response = await agent.post('/api/auth/refresh').expect(200);

      expectNoTokensInBody(response.body as Record<string, unknown>);
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('access_token='),
          expect.stringContaining('refresh_token='),
        ]),
      );
    });

    it('возвращает 401 для refresh с подделанной подписью', async () => {
      const response = await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tampered')
        .expect(401);

      expect(parseApiErrorBody(response.body).code).toBe('UNAUTHORIZED');
    });

    it('возвращает 401 для истёкшего refresh-токена', async () => {
      const jwtService = app.get(JwtService);
      const config = app.get(ConfigService<Env, true>);
      const expired = await jwtService.signAsync(
        { sub: 'user-expired', jti: 'expired-jti' },
        {
          secret: config.get('JWT_REFRESH_SECRET', { infer: true }),
          expiresIn: '0s',
        },
      );

      await redis.client.set('refresh:user-expired:expired-jti', '1', 'EX', 60);

      const response = await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${expired}`)
        .expect(401);

      expect(parseApiErrorBody(response.body).code).toBe('UNAUTHORIZED');
    });

    it('возвращает 401 после logout (jti удалён из Redis)', async () => {
      const agent = request.agent(server);
      await agent.post('/api/auth/register').send(credentials);
      const beforeLogout = await agent.post('/api/auth/refresh');
      const refreshCookie = extractCookie(beforeLogout.headers['set-cookie'], 'refresh_token');

      await agent.post('/api/auth/logout').expect(204);

      const response = await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refreshCookie}`)
        .expect(401);

      expect(parseApiErrorBody(response.body).code).toBe('UNAUTHORIZED');
    });

    describe('конкурентное обновление токена (grace-окно, #50)', () => {
      it('два параллельных запроса с одним jti оба успешны и ставят одну пару cookie', async () => {
        const registered = await request(server)
          .post('/api/auth/register')
          .send(credentials)
          .expect(201);
        const oldRefresh = extractCookie(registered.headers['set-cookie'], 'refresh_token');
        expect(oldRefresh).toBeDefined();
        const cookie = `refresh_token=${oldRefresh}`;

        const [first, second] = await Promise.all([
          request(server).post('/api/auth/refresh').set('Cookie', cookie),
          request(server).post('/api/auth/refresh').set('Cookie', cookie),
        ]);

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);

        const firstRefresh = extractCookie(first.headers['set-cookie'], 'refresh_token');
        const secondRefresh = extractCookie(second.headers['set-cookie'], 'refresh_token');
        expect(firstRefresh).toBeDefined();
        expect(firstRefresh).toBe(secondRefresh);
        expect(extractCookie(first.headers['set-cookie'], 'access_token')).toBe(
          extractCookie(second.headers['set-cookie'], 'access_token'),
        );

        await request(server)
          .post('/api/auth/refresh')
          .set('Cookie', `refresh_token=${firstRefresh}`)
          .expect(200);
      });

      it('сразу после ротации старый jti ещё принимается и отдаёт ту же пару', async () => {
        const registered = await request(server)
          .post('/api/auth/register')
          .send(credentials)
          .expect(201);
        const oldRefresh = extractCookie(registered.headers['set-cookie'], 'refresh_token');
        const cookie = `refresh_token=${oldRefresh}`;

        const rotated = await request(server)
          .post('/api/auth/refresh')
          .set('Cookie', cookie)
          .expect(200);
        const replay = await request(server)
          .post('/api/auth/refresh')
          .set('Cookie', cookie)
          .expect(200);

        expect(extractCookie(replay.headers['set-cookie'], 'refresh_token')).toBe(
          extractCookie(rotated.headers['set-cookie'], 'refresh_token'),
        );
        expect(extractCookie(replay.headers['set-cookie'], 'access_token')).toBe(
          extractCookie(rotated.headers['set-cookie'], 'access_token'),
        );
      });

      it('выход сразу после обновления токена инвалидирует и старый, и новый jti', async () => {
        const registered = await request(server)
          .post('/api/auth/register')
          .send(credentials)
          .expect(201);
        const accessToken = extractCookie(registered.headers['set-cookie'], 'access_token');
        const oldRefresh = extractCookie(registered.headers['set-cookie'], 'refresh_token');

        const rotated = await request(server)
          .post('/api/auth/refresh')
          .set('Cookie', `refresh_token=${oldRefresh}`)
          .expect(200);
        const newRefresh = extractCookie(rotated.headers['set-cookie'], 'refresh_token');

        await request(server)
          .post('/api/auth/logout')
          .set('Cookie', `access_token=${accessToken}`)
          .expect(204);

        await request(server)
          .post('/api/auth/refresh')
          .set('Cookie', `refresh_token=${oldRefresh}`)
          .expect(401);
        await request(server)
          .post('/api/auth/refresh')
          .set('Cookie', `refresh_token=${newRefresh}`)
          .expect(401);
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('идемпотентен без сессии', async () => {
      await request(server).post('/api/auth/logout').expect(204);
    });

    it('очищает cookie и инвалидирует refresh', async () => {
      const agent = request.agent(server);
      await agent.post('/api/auth/register').send(credentials);

      const logout = await agent.post('/api/auth/logout').expect(204);
      const cleared = logout.headers['set-cookie'];

      expect(cleared).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/access_token=;/),
          expect.stringMatching(/refresh_token=;/),
        ]),
      );

      await agent.post('/api/auth/refresh').expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('возвращает текущего пользователя по access cookie', async () => {
      const agent = request.agent(server);
      const register = await agent.post('/api/auth/register').send(credentials);

      const response = await agent.get('/api/auth/me').expect(200);

      const registerBody = parseAuthUserBody(register.body);
      const body = parseAuthUserBody(response.body);

      expect(body.user.id).toBe(registerBody.user.id);
      expect(body.user.email).toBe(credentials.email);
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('возвращает 401 без access cookie', async () => {
      const response = await request(server).get('/api/auth/me').expect(401);

      expect(parseApiErrorBody(response.body).code).toBe('UNAUTHORIZED');
    });

    it('возвращает 401 при невалидном access cookie', async () => {
      const response = await request(server)
        .get('/api/auth/me')
        .set('Cookie', 'access_token=invalid.token.value')
        .expect(401);

      expect(parseApiErrorBody(response.body).code).toBe('UNAUTHORIZED');
    });
  });

  describe('«Запомнить меня» (персистентная refresh-cookie, #51)', () => {
    beforeEach(async () => {
      await request(server).post('/api/auth/register').send(credentials);
    });

    it('login с rememberMe: true → refresh-cookie с Max-Age', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ ...credentials, rememberMe: true })
        .expect(200);

      expect(rawSetCookie(response.headers['set-cookie'], 'refresh_token')).toMatch(/Max-Age=\d+/i);
    });

    it('login без rememberMe → сессионная refresh-cookie (без Max-Age)', async () => {
      const response = await request(server).post('/api/auth/login').send(credentials).expect(200);

      expect(rawSetCookie(response.headers['set-cookie'], 'refresh_token')).not.toMatch(
        /Max-Age=|Expires=/i,
      );
    });

    it('refresh сохраняет персистентность (остаётся с Max-Age)', async () => {
      const agent = request.agent(server);
      await agent
        .post('/api/auth/login')
        .send({ ...credentials, rememberMe: true })
        .expect(200);

      const response = await agent.post('/api/auth/refresh').expect(200);

      expect(rawSetCookie(response.headers['set-cookie'], 'refresh_token')).toMatch(/Max-Age=\d+/i);
    });
  });

  // #102: серверный guard (ADR-003) на /app/* должен видеть refresh-cookie на
  // первом запросе к /app. Прежний `Path=/api/auth/refresh` не доходил до /app →
  // remember-me не восстанавливался. Ставим `Path=/`, старую cookie на узком
  // path — вычищаем (иначе у существующих сессий останется висячая пара).
  describe('refresh cookie path (#102)', () => {
    beforeEach(async () => {
      await request(server).post('/api/auth/register').send(credentials);
    });

    // активная refresh-cookie: непустое значение + Path=/ + НЕ очищающая.
    const isActiveRootRefresh = (c: string) =>
      c.startsWith('refresh_token=') &&
      c.split(';')[0].length > 'refresh_token='.length &&
      cookiePath(c) === '/' &&
      !isCleared(c);

    // очистка legacy-cookie строго на узком path.
    const isLegacyRefreshClear = (c: string) =>
      c.startsWith('refresh_token=') && cookiePath(c) === '/api/auth/refresh' && isCleared(c);

    it('register: refresh-cookie с Path=/ и чистит legacy Path=/api/auth/refresh', async () => {
      const res = await request(server)
        .post('/api/auth/register')
        .send({ email: 'p102-reg@example.com', password: 'password123' })
        .expect(201);
      const cookies = allSetCookies(res.headers['set-cookie'], 'refresh_token');
      expect(cookies.some(isActiveRootRefresh)).toBe(true);
      expect(cookies.some(isLegacyRefreshClear)).toBe(true);
    });

    it('login: refresh-cookie с Path=/ и чистит legacy', async () => {
      const res = await request(server).post('/api/auth/login').send(credentials).expect(200);
      const cookies = allSetCookies(res.headers['set-cookie'], 'refresh_token');
      expect(cookies.some(isActiveRootRefresh)).toBe(true);
      expect(cookies.some(isLegacyRefreshClear)).toBe(true);
    });

    it('миграция старой сессии: refresh со старой узкой cookie → корневая активна, старая удалена', async () => {
      // Логинимся и берём валидный refresh-токен — он представляет СТАРУЮ сессию,
      // чья cookie лежала на Path=/api/auth/refresh. Браузер с такой cookie шлёт её
      // именно на /api/auth/refresh — воспроизводим это Cookie-заголовком.
      const login = await request(server).post('/api/auth/login').send(credentials).expect(200);
      const oldRefresh = extractCookie(login.headers['set-cookie'], 'refresh_token');
      expect(oldRefresh).toBeDefined();

      const res = await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${oldRefresh}`)
        .expect(200);

      const cookies = allSetCookies(res.headers['set-cookie'], 'refresh_token');
      expect(cookies.some(isActiveRootRefresh)).toBe(true); // новая корневая активна
      expect(cookies.some(isLegacyRefreshClear)).toBe(true); // старая узкая удалена

      // И новая корневая cookie реально рабочая — ею можно рефрешнуться снова.
      const newRefresh = extractCookie(res.headers['set-cookie'], 'refresh_token');
      await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${newRefresh}`)
        .expect(200);
    });

    it('logout: чистит refresh и на Path=/, и на legacy Path=/api/auth/refresh', async () => {
      const agent = request.agent(server);
      await agent.post('/api/auth/login').send(credentials).expect(200);
      const res = await agent.post('/api/auth/logout').expect(204);
      const cookies = allSetCookies(res.headers['set-cookie'], 'refresh_token');
      expect(cookies.some((c) => cookiePath(c) === '/' && isCleared(c))).toBe(true);
      expect(cookies.some(isLegacyRefreshClear)).toBe(true);
    });
  });
});

function extractCookie(
  setCookieHeader: string | string[] | undefined,
  name: string,
): string | undefined {
  if (!setCookieHeader) {
    return undefined;
  }

  const entries = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  // Активная cookie — с непустым значением. После #102 refresh_token приходит
  // дважды (активная корневая + очищающая legacy с пустым значением); берём
  // активную независимо от порядка Set-Cookie.
  const raw = entries.find((entry) => {
    if (!entry.startsWith(`${name}=`)) {
      return false;
    }
    const value = entry.split(';')[0]?.slice(name.length + 1) ?? '';
    return value.length > 0;
  });
  if (!raw) {
    return undefined;
  }

  return raw.split(';')[0]?.slice(name.length + 1);
}

/**
 * Полная строка Set-Cookie (с атрибутами) активной cookie — для проверки
 * Max-Age/Expires. Пропускает очищающие записи с пустым значением (после #102
 * refresh_token приходит и как очистка legacy), чтобы не зависеть от порядка.
 */
function rawSetCookie(setCookieHeader: string | string[] | undefined, name: string): string {
  const entries = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  return (
    entries.find((entry) => {
      if (!entry.startsWith(`${name}=`)) {
        return false;
      }
      const value = entry.split(';')[0]?.slice(name.length + 1) ?? '';
      return value.length > 0;
    }) ?? ''
  );
}

/** Все Set-Cookie по имени (их может быть несколько: активная + очистка legacy). */
function allSetCookies(setCookieHeader: string | string[] | undefined, name: string): string[] {
  const entries = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  return entries.filter((entry) => entry.startsWith(`${name}=`));
}

/** Значение атрибута Path (точно, по границе `;`). */
function cookiePath(cookie: string): string | undefined {
  return /(?:^|;\s*)Path=([^;]*)/i.exec(cookie)?.[1];
}

/**
 * Очищающая ли cookie: Max-Age ≤ 0 (приоритетнее), иначе Expires в прошлом.
 * Точные границы: `Max-Age=0123` — это 123 (>0), не «Max-Age=0»; будущий
 * Expires не считается очисткой.
 */
function isCleared(cookie: string): boolean {
  const maxAge = /(?:^|;\s*)Max-Age=(-?\d+)(?:;|$)/i.exec(cookie);
  if (maxAge) {
    return Number(maxAge[1]) <= 0;
  }
  const expires = /(?:^|;\s*)Expires=([^;]+)/i.exec(cookie);
  if (expires) {
    const ts = Date.parse(expires[1]);
    return Number.isFinite(ts) && ts <= Date.now();
  }
  return false;
}
