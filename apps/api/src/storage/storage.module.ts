import { Global, Module } from '@nestjs/common';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.schema';
import { S3_CLIENT } from './storage.constants';
import { StorageService } from './storage.service';

const s3ClientProvider: Provider = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): S3Client =>
    new S3Client({
      region: config.get('STORAGE_REGION', { infer: true }),
      endpoint: config.get('STORAGE_ENDPOINT', { infer: true }),
      credentials: {
        accessKeyId: config.get('AWS_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('AWS_SECRET_ACCESS_KEY', { infer: true }),
      },
    }),
};

/** Global — клиент и конфигурация хранилища доступны во всех модулях. */
@Global()
@Module({
  providers: [s3ClientProvider, StorageService],
  exports: [s3ClientProvider, StorageService],
})
export class StorageModule {}
