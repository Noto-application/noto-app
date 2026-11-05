import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.schema';
import { S3_CLIENT } from './storage.constants';
import type { S3Client } from '@aws-sdk/client-s3';

const DEFAULT_PRESIGNED_URL_TTL_SECONDS = 15 * 60;
const READ_URL_CACHE_LIMIT = 1000;

@Injectable()
export class StorageService implements OnModuleDestroy {
  readonly bucket: string;
  private readonly readUrlCache = new Map<string, { url: string; expiresAt: number }>();

  constructor(
    @Inject(S3_CLIENT) public readonly client: S3Client,
    config: ConfigService<Env, true>,
  ) {
    this.bucket = config.get('STORAGE_BUCKET', { infer: true });
  }

  createUploadUrl(key: string, contentType: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: DEFAULT_PRESIGNED_URL_TTL_SECONDS },
    );
  }

  createReadUrl(key: string): Promise<string> {
    const now = Date.now();
    const cached = this.readUrlCache.get(key);
    if (cached && cached.expiresAt > now + 60_000) {
      return Promise.resolve(cached.url);
    }

    const minuteBoundary = Math.floor(now / 60_000) * 60_000;
    const signingDate =
      minuteBoundary + DEFAULT_PRESIGNED_URL_TTL_SECONDS * 1000 > now + 60_000
        ? new Date(minuteBoundary)
        : new Date(now);
    const expiresAt = signingDate.getTime() + DEFAULT_PRESIGNED_URL_TTL_SECONDS * 1000;

    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: DEFAULT_PRESIGNED_URL_TTL_SECONDS,
      signingDate,
    }).then((url) => {
      if (this.readUrlCache.size >= READ_URL_CACHE_LIMIT) {
        const oldestKey = this.readUrlCache.keys().next().value;
        if (oldestKey) {
          this.readUrlCache.delete(oldestKey);
        }
      }
      this.readUrlCache.set(key, { url, expiresAt });
      return url;
    });
  }

  headObject(key: string) {
    return this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  getObject(key: string): Promise<GetObjectCommandOutput> {
    return this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.client
      .send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      )
      .then(() => undefined);
  }

  deleteObject(key: string): Promise<void> {
    return this.client
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
      .then(() => undefined);
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
