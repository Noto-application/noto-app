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
  // Тот же HTTP-обвес, что и в проде (cookie/prefix/CORS) — issue #96.
  await configureApp(app, app.get(ConfigService<Env, true>));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
  };
}

export async function resetAuthState(
  prisma: PrismaService,
  redis: RedisService,
): Promise<void> {
  // register создаёт дефолтный проект + membership (issue #88), поэтому чистим
  // и их — иначе проекты копятся между тестами.
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await redis.client.flushdb();
}
