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
  const host = config.get('HOST', { infer: true });
  // HOST: loopback в dev (internal endpoint не в обход Caddy, #108), 0.0.0.0 в
  // контейнере/проде — тогда изоляцию порта даёт приватная сеть.
  await app.listen(port, host);

  Logger.log(`API слушает http://${host}:${port} (health: /health)`, 'Bootstrap');
}

void bootstrap();
