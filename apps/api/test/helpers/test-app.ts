import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';

import { AppModule } from '../../src/app.module';
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
  await app.register(cookie);
  app.setGlobalPrefix('api', { exclude: ['health'] });
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
  await prisma.user.deleteMany();
  await redis.client.flushdb();
}
