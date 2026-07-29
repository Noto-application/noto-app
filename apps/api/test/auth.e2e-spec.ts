import type { Server } from 'node:http';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../src/config/env.schema';
import { createTestApp, resetAuthState } from './helpers/test-app';

const credentials = {
  email: 'auth-test@example.com',
  password: 'password123',
};

function expectNoTokensInBody(body: Record<string, unknown>): void {
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

      expect(response.body.user).toMatchObject({
        email: credentials.email,
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expectNoTokensInBody(response.body);

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

    it('возвращает 409 если email занят и не создаёт второго пользователя', async () => {
      const agent = request.agent(server);
      await agent.post('/api/auth/register').send(credentials).expect(201);

      const response = await agent
        .post('/api/auth/register')
        .send(credentials)
        .expect(409);

      expect(response.body).toMatchObject({
        code: 'EMAIL_TAKEN',
      });

      expect(await prisma.user.count()).toBe(1);
    });

    it('возвращает 400 при коротком пароле', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({ email: 'short@example.com', password: 'short' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(await prisma.user.count()).toBe(0);
    });

    it('возвращает 400 при некорректном email', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
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

      expect(response.body.user.email).toBe(credentials.email);
      expectNoTokensInBody(response.body);
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

      expect(response.body).toEqual({
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

      expect(missingEmail.body).toEqual(wrongPassword.body);
    });

    it('возвращает 400 при невалидном теле', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ email: 'bad', password: '123' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('возвращает 401 без refresh cookie', async () => {
      const response = await request(server).post('/api/auth/refresh').expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('обновляет cookie и не возвращает токены в теле', async () => {
      const agent = request.agent(server);
      await agent.post('/api/auth/register').send(credentials);

      const response = await agent.post('/api/auth/refresh').expect(200);

      expectNoTokensInBody(response.body ?? {});
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

      expect(response.body.code).toBe('UNAUTHORIZED');
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

      expect(response.body.code).toBe('UNAUTHORIZED');
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

      expect(response.body.code).toBe('UNAUTHORIZED');
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

      expect(response.body.user.id).toBe(register.body.user.id);
      expect(response.body.user.email).toBe(credentials.email);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('возвращает 401 без access cookie', async () => {
      const response = await request(server).get('/api/auth/me').expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('возвращает 401 при невалидном access cookie', async () => {
      const response = await request(server)
        .get('/api/auth/me')
        .set('Cookie', 'access_token=invalid.token.value')
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
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
  const raw = entries.find((entry) => entry.startsWith(`${name}=`));
  if (!raw) {
    return undefined;
  }

  return raw.split(';')[0]?.slice(name.length + 1);
}
