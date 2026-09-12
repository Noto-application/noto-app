import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app-setup';
import type { Env } from '../../src/config/env.schema';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';

export const TEST_CORS_ORIGIN = 'http://localhost:3000';

export interface TestAppContext {
  app: NestFastifyApplication;
  prisma: PrismaService;
  redis: RedisService;
}

export async function createTestApp(): Promise<TestAppContext> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  const config = app.get(ConfigService<Env, true>);
  // Фиксируем origin тестового приложения независимо от локального .env.
  config.set('CORS_ORIGIN', TEST_CORS_ORIGIN);
  // Тот же HTTP-обвес, что и в проде (cookie/prefix/CORS) — issue #96.
  await configureApp(app, config);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  // Один случайный порт на suite: supertest не переоткрывает сервер на каждый
  // запрос и не переиспользует соединения к уже закрытому временному listener.
  await app.listen(0, '127.0.0.1');

  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);
  // Каждый suite начинает с пустого состояния, независимо от порядка запуска.
  await resetAuthState(prisma, redis);

  return {
    app,
    prisma,
    redis,
  };
}

export async function resetAuthState(prisma: PrismaService, redis: RedisService): Promise<void> {
  // Полный reset в порядке внешних ключей; одинаковый для всех suite.
  await prisma.$transaction([
    prisma.page.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  await redis.client.flushdb();
}
