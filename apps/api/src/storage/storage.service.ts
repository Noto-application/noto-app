import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { S3_CLIENT } from './storage.constants';
import type { S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService implements OnModuleDestroy {
  readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT) public readonly client: S3Client,
    config: ConfigService<Env, true>,
  ) {
    this.bucket = config.get('STORAGE_BUCKET', { infer: true });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
