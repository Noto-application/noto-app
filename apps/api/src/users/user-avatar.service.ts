import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import sharp from 'sharp';
import type { Metadata } from 'sharp';
import { AVATAR_MAX_NORMALIZED_SIZE, AVATAR_MAX_UPLOAD_SIZE } from '@noto/shared';
import type {
  AvatarUploadResponse,
  CreateAvatarUploadInput,
  User as PublicUser,
} from '@noto/shared';

import { ApiErrors } from '../lib/errors';
import { toPublicUserWithAvatar } from '../lib/utils/to-public-user';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from './users.service';

const PRESIGNED_UPLOAD_TTL_SECONDS = 15 * 60;
const UPLOAD_LIFETIME_MS = 24 * 60 * 60 * 1000;
const DEFERRED_DELETE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;
const NORMALIZED_CONTENT_TYPE = 'image/webp';

@Injectable()
export class UserAvatarService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserAvatarService.name);
  private cleanupTimer: NodeJS.Timeout | undefined;
  private cleanupPromise: Promise<void> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      void this.runCleanup();
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
    void this.runCleanup();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  async createUpload(
    userId: string,
    input: CreateAvatarUploadInput,
  ): Promise<AvatarUploadResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw ApiErrors.unauthorized('User not found');
    }

    const now = new Date();
    const storageKey = randomUUID();
    const record = await this.prisma.userAvatar.create({
      data: {
        ownerId: userId,
        storageKey,
        contentType: input.contentType,
        size: input.size,
        status: 'pending',
        expiresAt: new Date(now.getTime() + UPLOAD_LIFETIME_MS),
      },
    });
    const url = await this.storage.createUploadUrl(storageKey, input.contentType);

    return {
      upload: {
        uploadId: record.id,
        url,
        method: 'PUT',
        headers: { 'Content-Type': input.contentType },
        expiresAt: new Date(now.getTime() + PRESIGNED_UPLOAD_TTL_SECONDS * 1000).toISOString(),
      },
    };
  }

  async confirmUpload(userId: string, uploadId: string): Promise<PublicUser> {
    const upload = await this.prisma.userAvatar.findUnique({ where: { id: uploadId } });
    if (!upload || upload.ownerId !== userId) {
      throw ApiErrors.notFound('Avatar upload not found');
    }

    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarId: true },
    });
    if (!profile) {
      throw ApiErrors.unauthorized('User not found');
    }
    if (profile.avatarId === upload.id || upload.resultAvatarId) {
      return this.usersService.findById(userId);
    }
    if (upload.status !== 'pending' || !upload.expiresAt || upload.expiresAt <= new Date()) {
      throw ApiErrors.validation('Avatar upload has expired or is not pending');
    }

    const now = new Date();
    const cleanupAt = new Date(now.getTime() + UPLOAD_LIFETIME_MS);
    const claimed = await this.prisma.userAvatar.updateMany({
      where: {
        id: upload.id,
        ownerId: userId,
        status: 'pending',
        expiresAt: { gt: now },
      },
      data: {
        status: 'processing',
        expiresAt: cleanupAt,
      },
    });
    if (claimed.count !== 1) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { avatarId: true },
      });
      if (currentUser?.avatarId === upload.id) {
        return this.usersService.findById(userId);
      }
      throw ApiErrors.validation('Avatar upload has expired or is already being processed');
    }

    const sourceBytes = await this.readAndValidateUpload(upload.storageKey);
    const normalized = await this.normalizeImage(sourceBytes);
    if (normalized.length > AVATAR_MAX_NORMALIZED_SIZE) {
      throw ApiErrors.validation('Normalized avatar exceeds the size limit');
    }

    const normalizedStorageKey = randomUUID();
    const normalizedAvatar = await this.prisma.userAvatar.create({
      data: {
        ownerId: userId,
        storageKey: normalizedStorageKey,
        contentType: NORMALIZED_CONTENT_TYPE,
        size: normalized.length,
        status: 'processing',
        expiresAt: cleanupAt,
      },
    });
    await this.storage.putObject(normalizedStorageKey, normalized, NORMALIZED_CONTENT_TYPE);

    const user = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
      const currentUser = await transaction.user.findUnique({
        where: { id: userId },
        select: { avatarId: true },
      });
      if (!currentUser) {
        throw ApiErrors.unauthorized('User not found');
      }

      await transaction.userAvatar.update({
        where: { id: normalizedAvatar.id },
        data: {
          status: 'ready',
          expiresAt: null,
          deleteAfter: null,
        },
      });
      await transaction.userAvatar.update({
        where: { id: upload.id },
        data: {
          status: 'deletePending',
          expiresAt: null,
          deleteAfter: new Date(),
          resultAvatarId: normalizedAvatar.id,
        },
      });
      const updatedUser = await transaction.user.update({
        where: { id: userId },
        data: { avatarId: normalizedAvatar.id },
        include: { avatar: true },
      });

      if (currentUser.avatarId && currentUser.avatarId !== normalizedAvatar.id) {
        await transaction.userAvatar.updateMany({
          where: { id: currentUser.avatarId, status: 'ready' },
          data: {
            status: 'deletePending',
            deleteAfter: new Date(Date.now() + DEFERRED_DELETE_MS),
          },
        });
      }
      return updatedUser;
    });

    return toPublicUserWithAvatar(user, (key) => this.storage.createReadUrl(key));
  }

  async remove(userId: string): Promise<PublicUser> {
    const user = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
      const currentUser = await transaction.user.findUnique({
        where: { id: userId },
        select: { avatarId: true },
      });
      if (!currentUser) {
        throw ApiErrors.unauthorized('User not found');
      }

      const updatedUser = await transaction.user.update({
        where: { id: userId },
        data: { avatarId: null },
        include: { avatar: true },
      });
      if (currentUser.avatarId) {
        await transaction.userAvatar.updateMany({
          where: { id: currentUser.avatarId, status: 'ready' },
          data: {
            status: 'deletePending',
            deleteAfter: new Date(Date.now() + DEFERRED_DELETE_MS),
          },
        });
      }
      return updatedUser;
    });

    return toPublicUserWithAvatar(user, (key) => this.storage.createReadUrl(key));
  }

  private async readAndValidateUpload(key: string): Promise<Buffer> {
    let head: Awaited<ReturnType<StorageService['headObject']>>;
    try {
      head = await this.storage.headObject(key);
    } catch (error) {
      if (isMissingStorageObject(error)) {
        throw ApiErrors.validation('Uploaded avatar object was not found');
      }
      throw error;
    }

    if (!head.ContentLength || head.ContentLength > AVATAR_MAX_UPLOAD_SIZE) {
      throw ApiErrors.validation('Uploaded avatar size is invalid');
    }

    const response = await this.storage.getObject(key);
    const body = response.Body;
    if (!body || typeof body !== 'object' || !(Symbol.asyncIterator in body)) {
      throw ApiErrors.validation('Uploaded avatar could not be read');
    }

    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      const buffer = Buffer.from(chunk);
      totalSize += buffer.length;
      if (totalSize > AVATAR_MAX_UPLOAD_SIZE) {
        throw ApiErrors.validation('Uploaded avatar exceeds the size limit');
      }
      chunks.push(buffer);
    }
    if (totalSize === 0 || totalSize > AVATAR_MAX_UPLOAD_SIZE) {
      throw ApiErrors.validation('Uploaded avatar size is invalid');
    }
    if (totalSize !== head.ContentLength) {
      throw ApiErrors.validation('Uploaded avatar size does not match storage metadata');
    }

    const bytes = Buffer.concat(chunks, totalSize);
    await this.getImageMetadata(bytes);
    return bytes;
  }

  private async normalizeImage(bytes: Buffer): Promise<Buffer> {
    try {
      return await sharp(bytes, { failOn: 'error', limitInputPixels: 40_000_000 })
        .rotate()
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .webp()
        .toBuffer();
    } catch {
      throw ApiErrors.validation('Uploaded image could not be decoded or normalized');
    }
  }

  private async getImageMetadata(bytes: Buffer): Promise<Metadata> {
    let metadata: Metadata;
    try {
      metadata = await sharp(bytes, {
        failOn: 'error',
        limitInputPixels: 40_000_000,
      }).metadata();
    } catch {
      throw ApiErrors.validation('Uploaded image could not be decoded');
    }
    if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw ApiErrors.validation('Uploaded file is not a supported image');
    }
    return metadata;
  }

  /** Выполняет проход очистки; параллельные вызовы дожидаются текущего. */
  async runCleanup(): Promise<void> {
    if (this.cleanupPromise) {
      await this.cleanupPromise;
      return;
    }

    const cleanup = this.performCleanup();
    this.cleanupPromise = cleanup;
    try {
      await cleanup;
    } finally {
      if (this.cleanupPromise === cleanup) {
        this.cleanupPromise = undefined;
      }
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      await this.deleteExpiredUploads();
      await this.deleteExpiredAvatars();
      await this.deleteProcessedSources();
    } catch (error) {
      this.logger.error('Avatar cleanup batch failed', error);
    }
  }

  private async deleteExpiredUploads(): Promise<void> {
    const expired = await this.prisma.userAvatar.findMany({
      where: {
        status: { in: ['pending', 'processing'] },
        expiresAt: { lte: new Date() },
      },
      take: CLEANUP_BATCH_SIZE,
    });

    for (const avatar of expired) {
      try {
        await this.storage.deleteObject(avatar.storageKey);
        if (avatar.sourceStorageKey) {
          await this.storage.deleteObject(avatar.sourceStorageKey);
        }
        await this.prisma.userAvatar.deleteMany({
          where: {
            id: avatar.id,
            status: { in: ['pending', 'processing'] },
            expiresAt: { lte: new Date() },
          },
        });
      } catch (error) {
        this.logger.error(`Failed to clean expired avatar record ${avatar.id}`, error);
      }
    }
  }

  private async deleteExpiredAvatars(): Promise<void> {
    const expired = await this.prisma.userAvatar.findMany({
      where: {
        status: 'deletePending',
        deleteAfter: { lte: new Date() },
      },
      take: CLEANUP_BATCH_SIZE,
    });

    for (const avatar of expired) {
      try {
        await this.storage.deleteObject(avatar.storageKey);
        if (avatar.sourceStorageKey) {
          await this.storage.deleteObject(avatar.sourceStorageKey);
        }
        await this.prisma.userAvatar.deleteMany({
          where: {
            id: avatar.id,
            status: 'deletePending',
            deleteAfter: { lte: new Date() },
          },
        });
      } catch (error) {
        this.logger.error(`Failed to delete retired avatar ${avatar.id}`, error);
      }
    }
  }

  private async deleteProcessedSources(): Promise<void> {
    const completed = await this.prisma.userAvatar.findMany({
      where: { status: 'ready', sourceStorageKey: { not: null } },
      take: CLEANUP_BATCH_SIZE,
    });

    for (const avatar of completed) {
      if (!avatar.sourceStorageKey) {
        continue;
      }
      const sourceKey = avatar.sourceStorageKey;
      try {
        await this.storage.deleteObject(sourceKey);
        await this.prisma.userAvatar.updateMany({
          where: { id: avatar.id, status: 'ready', sourceStorageKey: sourceKey },
          data: { sourceStorageKey: null },
        });
      } catch (error) {
        this.logger.error(`Failed to delete source image for avatar ${avatar.id}`, error);
      }
    }
  }
}

function isMissingStorageObject(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'NotFound' || error.name === 'NoSuchKey';
  }
  return false;
}
