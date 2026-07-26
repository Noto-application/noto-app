import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Server } from 'node:http';
import request from 'supertest';
import { HealthModule } from '../src/health/health.module';

describe('GET /health (e2e)', () => {
  let app: NestFastifyApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();
    // Fastify регистрирует роуты асинхронно — ждём готовности до supertest.
    await app.getHttpAdapter().getInstance().ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('отвечает 200 и status ok', async () => {
    const response = await request(server).get('/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('не отвечает на /api/health — health вне глобального префикса', async () => {
    await request(server).get('/api/health').expect(404);
  });
});
