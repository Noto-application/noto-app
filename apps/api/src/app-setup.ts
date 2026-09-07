import cookie from '@fastify/cookie';
import type { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import type { Env } from './config/env.schema';

/** HTTP-методы, используемые REST-контрактом (ts-rest). Явный список нужен,
 * чтобы CORS-preflight разрешал `PATCH`/`DELETE` — дефолт `@fastify/cors`
 * (`GET,HEAD,POST`) их резал, ломая автосейв и удаление страницы (issue #96). */
const CORS_METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'];

/**
 * Единая конфигурация Fastify-приложения — общий источник для прод-бутстрапа
 * (`main.ts`) и e2e (`test/helpers/test-app.ts`). Держим здесь, чтобы тесты
 * покрывали ровно тот HTTP-обвес (cookie/prefix/CORS), что работает в проде,
 * и он не расходился между путями (issue #96).
 */
export async function configureApp(
  app: NestFastifyApplication,
  config: ConfigService<Env, true>,
): Promise<void> {
  await app.register(cookie);

  // /health остаётся вне префикса: его дёргают healthcheck'и контейнера.
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // credentials: true обязателен — токены живут в HttpOnly cookie (ADR-003).
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
    methods: CORS_METHODS,
  });
}
