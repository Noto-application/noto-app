import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  // FastifyAdapter вместо Express: быстрее на HTTP и ближе к прод-нагрузке.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const config = app.get(ConfigService<Env, true>);

  // cookie + глобальный префикс + CORS — общий обвес для прода и e2e.
  await configureApp(app, config);

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  // '0.0.0.0' — иначе Fastify слушает только 127.0.0.1, недоступен из контейнера.
  await app.listen(port, '0.0.0.0');

  Logger.log(`API слушает http://localhost:${port} (health: /health)`, 'Bootstrap');
}

void bootstrap();
