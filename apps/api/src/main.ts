import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // /health остаётся вне префикса: его дёргают healthcheck'и контейнера.
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // credentials: true обязателен — токены живут в HttpOnly cookie (ADR-003).
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  Logger.log(`API слушает http://localhost:${port} (health: /health)`, 'Bootstrap');
}

void bootstrap();
