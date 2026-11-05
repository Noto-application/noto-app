import { Readable } from 'node:stream';
import type { Server } from 'node:http';
import { deflateSync } from 'node:zlib';
import sharp from 'sharp';
import request from 'supertest';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';

import { S3_CLIENT } from '../src/storage/storage.constants';
import { StorageService } from '../src/storage/storage.service';
import { UserAvatarService } from '../src/users/user-avatar.service';
import { createTestApp, resetAuthState } from './helpers/test-app';

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_AVATAR_SIZE = 256 * 1024;
const PNG = createPng(1024, 768);

interface StoredObject {
  body: Buffer;
  contentType: string;
  reportedSize?: number;
}

type JsonObject = Record<string, unknown>;

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  let crc = 0xffffffff;
  for (const byte of crcInput) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }

  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return chunk;
}

function createPng(width: number, height: number): Buffer {
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowStart + 1 + x * 4;
      scanlines[pixelOffset] = x % 256;
      scanlines[pixelOffset + 1] = y % 256;
      scanlines[pixelOffset + 2] = (x + y) % 256;
      scanlines[pixelOffset + 3] = 255;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function parseObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected a JSON object');
  }

  return value as JsonObject;
}

function parseString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected a string');
  }

  return value;
}

function parseNumber(value: unknown): number {
  if (typeof value !== 'number') {
    throw new Error('Expected a number');
  }

  return value;
}

function stableAvatarProperties(value: unknown): { contentType: string; size: number } {
  const avatar = parseObject(value);
  return {
    contentType: parseString(avatar.contentType),
    size: parseNumber(avatar.size),
  };
}

describe('User avatars (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];
  let avatarService: UserAvatarService;
  const storedObjects = new Map<string, StoredObject>();
  const deleteFailures = new Map<string, number>();
  const deleteAttempts = new Map<string, number>();
  let s3Send: jest.SpyInstance;

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();

    const s3Client = app.get<S3Client>(S3_CLIENT);
    // The S3 SDK's send method is promise-based; emulate command responses by key.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    s3Send = jest.spyOn(s3Client, 'send').mockImplementation((command) => {
      if (command instanceof HeadObjectCommand || command instanceof GetObjectCommand) {
        const object = storedObjects.get(command.input.Key ?? '');
        if (!object) {
          throw Object.assign(new Error('Object not found'), { name: 'NoSuchKey' });
        }

        if (command instanceof HeadObjectCommand) {
          return Promise.resolve({
            ContentLength: object.reportedSize ?? object.body.length,
            ContentType: object.contentType,
          } as never);
        }
        return Promise.resolve({
          Body: Readable.from([object.body]),
          ContentLength: object.body.length,
          ContentType: object.contentType,
        } as never);
      }

      if (command instanceof PutObjectCommand) {
        const { Key, Body, ContentType } = command.input;
        if (!Key || !Buffer.isBuffer(Body)) {
          throw new Error('Expected PutObjectCommand with a Buffer body and key');
        }
        storedObjects.set(Key, {
          body: Buffer.from(Body),
          contentType: ContentType ?? 'application/octet-stream',
        });
        return Promise.resolve({} as never);
      }

      if (command instanceof DeleteObjectCommand) {
        const key = command.input.Key;
        if (!key) {
          throw new Error('Expected DeleteObjectCommand with a key');
        }
        deleteAttempts.set(key, (deleteAttempts.get(key) ?? 0) + 1);
        const failuresLeft = deleteFailures.get(key) ?? 0;
        if (failuresLeft > 0) {
          deleteFailures.set(key, failuresLeft - 1);
          throw new Error('Simulated S3 delete failure');
        }
        storedObjects.delete(key);
        return Promise.resolve({} as never);
      }

      throw new Error(`Unexpected S3 command: ${command.constructor.name}`);
    });
    avatarService = app.get(UserAvatarService);
  });

  beforeEach(async () => {
    await resetAuthState(prisma, redis);
    storedObjects.clear();
    deleteFailures.clear();
    deleteAttempts.clear();
    s3Send.mockClear();
  });

  afterAll(async () => {
    s3Send.mockRestore();
    await app.close();
  });

  async function registerUser(email: string): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(server);
    await agent
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return agent;
  }

  function requestUpload(
    agent: ReturnType<typeof request.agent>,
    contentType = 'image/png',
    size = PNG.length,
  ) {
    return agent.post('/api/users/me/avatar/uploads').send({ contentType, size });
  }

  async function seedUploadedObject(
    uploadId: string,
    object: StoredObject = { body: PNG, contentType: 'image/png' },
  ): Promise<string> {
    const upload = await prisma.userAvatar.findUnique({ where: { id: uploadId } });
    if (!upload) {
      throw new Error(`Avatar upload ${uploadId} was not created`);
    }
    storedObjects.set(upload.storageKey, object);
    return upload.storageKey;
  }

  async function uploadAndConfirm(
    agent: ReturnType<typeof request.agent>,
    email: string,
  ): Promise<{ uploadId: string; user: JsonObject }> {
    const uploadResponse = await requestUpload(agent).expect(201);
    const upload = parseObject(parseObject(uploadResponse.body).upload);
    const uploadId = parseString(upload.uploadId);
    const uploadUrl = parseString(upload.url);

    expect(uploadId).not.toBe('');
    expect(uploadUrl).not.toBe('');
    expect(parseString(upload.method)).toBe('PUT');
    expect(parseObject(upload.headers)).toBeDefined();
    expect(parseString(upload.expiresAt)).not.toBe('');
    expect(new URL(uploadUrl).protocol).toBe('https:');
    expect(uploadUrl).not.toContain(email);

    await seedUploadedObject(uploadId);
    const confirmation = await agent
      .post(`/api/users/me/avatar/uploads/${uploadId}/confirm`)
      .expect(200);
    return { uploadId, user: parseObject(parseObject(confirmation.body).user) };
  }

  describe('upload permission', () => {
    it('requires authentication', async () => {
      await request(server)
        .post('/api/users/me/avatar/uploads')
        .send({ contentType: 'image/png', size: PNG.length })
        .expect(401);
    });

    it.each([
      ['unsupported format', 'image/gif', PNG.length],
      ['zero-byte file', 'image/png', 0],
      ['file over 5 MiB', 'image/png', MAX_UPLOAD_SIZE + 1],
    ])('rejects %s before issuing a signed URL', async (_case, contentType, size) => {
      const agent = await registerUser(`avatar-invalid-${Date.now()}@example.com`);

      const response = await requestUpload(agent, contentType, size).expect(400);

      const body = parseObject(response.body);
      expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(body).not.toHaveProperty('upload');
      expect(s3Send).not.toHaveBeenCalled();
    });

    it('issues a short-lived PUT URL for a valid image', async () => {
      const agent = await registerUser('avatar-presign@example.com');

      const response = await requestUpload(agent).expect(201);
      const upload = parseObject(parseObject(response.body).upload);
      const uploadExpiresAt = parseString(upload.expiresAt);

      expect(parseString(upload.uploadId)).not.toBe('');
      expect(parseString(upload.url)).not.toBe('');
      expect(parseString(upload.method)).toBe('PUT');
      expect(parseObject(upload.headers)).toBeDefined();
      expect(new Date(uploadExpiresAt).getTime()).toBeGreaterThan(Date.now());
      const body = parseObject(response.body);
      expect(body).not.toHaveProperty('storageKey');
      expect(body).not.toHaveProperty('bucket');
    });
  });

  describe('confirmation and profile avatar', () => {
    it('requires authentication to confirm or delete an avatar', async () => {
      await request(server)
        .post('/api/users/me/avatar/uploads/00000000-0000-0000-0000-000000000000/confirm')
        .expect(401);
      await request(server).delete('/api/users/me/avatar').expect(401);
    });

    it('confirms an owned upload and returns the normalized WebP avatar', async () => {
      const email = 'avatar-confirm@example.com';
      const agent = await registerUser(email);
      const sourceImage = await sharp(createPng(640, 320))
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer();
      const sourceMetadata = await sharp(sourceImage).metadata();
      expect(sourceMetadata.orientation).toBe(6);
      expect(sourceMetadata.exif).toBeDefined();

      const uploadResponse = await requestUpload(agent, 'image/jpeg', sourceImage.length).expect(
        201,
      );
      const uploadId = parseString(parseObject(parseObject(uploadResponse.body).upload).uploadId);
      const uploadRecord = await prisma.userAvatar.findUnique({
        where: { id: uploadId },
      });
      if (!uploadRecord) {
        throw new Error('Expected the source upload record');
      }
      storedObjects.set(uploadRecord.storageKey, {
        body: sourceImage,
        contentType: 'image/jpeg',
      });
      expect(storedObjects.get(uploadRecord.storageKey)?.body).toEqual(sourceImage);

      const confirmation = await agent
        .post(`/api/users/me/avatar/uploads/${uploadId}/confirm`)
        .expect(200);
      const user = parseObject(parseObject(confirmation.body).user);
      const avatar = parseObject(user.avatar);

      const avatarUrl = parseString(avatar.url);
      expect(avatarUrl).not.toBe('');
      expect(avatar.contentType).toBe('image/webp');
      expect(parseNumber(avatar.size)).toBeLessThanOrEqual(MAX_AVATAR_SIZE);
      expect(avatarUrl).not.toContain(uploadId);
      const profile = await agent.get('/api/users/me').expect(200);
      const profileUser = parseObject(parseObject(profile.body).user);
      expect(stableAvatarProperties(profileUser.avatar)).toEqual(
        stableAvatarProperties(avatar),
      );
      expect(profileUser).not.toHaveProperty('passwordHash');

      const databaseUser = await prisma.user.findUnique({
        where: { email },
        include: { avatar: true },
      });
      expect(databaseUser?.avatar).not.toBeNull();
      const activeAvatar = databaseUser?.avatar;
      if (!activeAvatar) {
        throw new Error('Expected an active avatar record');
      }
      const sourceStorageKey = uploadRecord.storageKey;
      expect(activeAvatar.storageKey).not.toBe(sourceStorageKey);
      expect(activeAvatar.sourceStorageKey).toBe(sourceStorageKey);

      const normalizedObject = storedObjects.get(activeAvatar.storageKey);
      expect(activeAvatar.status).toBe('active');
      if (!normalizedObject) {
        throw new Error('Normalized avatar object was not written to S3');
      }
      expect(normalizedObject.contentType).toBe('image/webp');
      expect(normalizedObject.body).not.toEqual(sourceImage);
      expect(normalizedObject.body.length).toBeLessThanOrEqual(MAX_AVATAR_SIZE);
      expect(activeAvatar.size).toBe(normalizedObject.body.length);
      const normalizedMetadata = await sharp(normalizedObject.body).metadata();
      expect(normalizedMetadata.format).toBe('webp');
      expect(normalizedMetadata.width).toBe(256);
      expect(normalizedMetadata.height).toBe(512);
      expect(normalizedMetadata.orientation).toBeUndefined();
      expect(normalizedMetadata.exif).toBeUndefined();
      expect(normalizedMetadata.icc).toBeUndefined();
      expect(normalizedMetadata.iptc).toBeUndefined();
      expect(normalizedMetadata.xmp).toBeUndefined();

      const decoded = await sharp(normalizedObject.body)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(decoded.info.width).toBe(256);
      expect(decoded.info.height).toBe(512);
      expect(decoded.data).toHaveLength(256 * 512 * decoded.info.channels);
      expect(decoded.data.some((value) => value !== 0)).toBe(true);
    });

    it('does not disclose or confirm another user’s upload', async () => {
      const owner = await registerUser('avatar-owner@example.com');
      const otherUser = await registerUser('avatar-other@example.com');
      const uploadResponse = await requestUpload(owner).expect(201);
      const uploadId = parseString(parseObject(parseObject(uploadResponse.body).upload).uploadId);

      await otherUser
        .post(`/api/users/me/avatar/uploads/${uploadId}/confirm`)
        .expect(404);
      const profile = await owner.get('/api/users/me').expect(200);
      expect(parseObject(parseObject(profile.body).user).avatar).toBeNull();
    });

    it('rejects an oversized object found in storage without changing the profile', async () => {
      const agent = await registerUser('avatar-oversized-object@example.com');
      const uploadResponse = await requestUpload(agent).expect(201);
      const uploadId = parseString(parseObject(parseObject(uploadResponse.body).upload).uploadId);
      await seedUploadedObject(uploadId, {
        body: PNG,
        contentType: 'image/png',
        reportedSize: MAX_UPLOAD_SIZE + 1,
      });

      await agent
        .post(`/api/users/me/avatar/uploads/${uploadId}/confirm`)
        .expect(400);
      const profile = await agent.get('/api/users/me').expect(200);
      expect(parseObject(parseObject(profile.body).user).avatar).toBeNull();
    });

    it('rejects content that is not an image even when the declared type is allowed', async () => {
      const agent = await registerUser('avatar-invalid-bytes@example.com');
      const uploadResponse = await requestUpload(agent, 'image/jpeg').expect(201);
      const uploadId = parseString(parseObject(parseObject(uploadResponse.body).upload).uploadId);
      await seedUploadedObject(uploadId, {
        body: Buffer.from('not an image'),
        contentType: 'image/jpeg',
      });

      await agent
        .post(`/api/users/me/avatar/uploads/${uploadId}/confirm`)
        .expect(400);
      const profile = await agent.get('/api/users/me').expect(200);
      expect(parseObject(parseObject(profile.body).user).avatar).toBeNull();
    });

    it('replaces an avatar and removes it without deleting the user profile', async () => {
      const agent = await registerUser('avatar-replace@example.com');
      const first = await uploadAndConfirm(agent, 'avatar-replace@example.com');
      const firstOwner = await prisma.user.findUnique({
        where: { email: 'avatar-replace@example.com' },
        include: { avatar: true },
      });
      const firstAvatar = firstOwner?.avatar;
      if (!firstAvatar?.sourceStorageKey) {
        throw new Error('Expected the first normalized avatar and source upload');
      }
      const firstNormalizedKey = firstAvatar.storageKey;
      const firstSourceKey = firstAvatar.sourceStorageKey;
      expect(firstNormalizedKey).not.toBe(firstSourceKey);

      const second = await uploadAndConfirm(agent, 'avatar-replace@example.com');
      const secondOwner = await prisma.user.findUnique({
        where: { email: 'avatar-replace@example.com' },
        include: { avatar: true },
      });
      const secondAvatarRecord = secondOwner?.avatar;
      if (!secondAvatarRecord?.sourceStorageKey) {
        throw new Error('Expected the second normalized avatar and source upload');
      }
      const secondNormalizedKey = secondAvatarRecord.storageKey;
      const secondSourceKey = secondAvatarRecord.sourceStorageKey;
      expect(secondNormalizedKey).not.toBe(secondSourceKey);
      const secondAvatar = stableAvatarProperties(second.user.avatar);
      expect(secondAvatar.contentType).toBe('image/webp');
      expect(secondAvatar.size).toBeGreaterThan(0);
      expect(secondAvatar.size).toBeLessThanOrEqual(MAX_AVATAR_SIZE);

      const retiredFirst = await prisma.userAvatar.findUnique({
        where: { id: first.uploadId },
      });
      expect(retiredFirst?.status).toBe('deletePending');
      expect(retiredFirst?.deleteAfter).toBeInstanceOf(Date);
      expect(retiredFirst?.deleteAfter?.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
      expect(retiredFirst?.deleteAfter?.getTime()).toBeLessThan(Date.now() + 25 * 60 * 60 * 1000);
      expect(retiredFirst?.storageKey).toBe(firstNormalizedKey);
      expect(retiredFirst?.sourceStorageKey).toBe(firstSourceKey);
      expect(storedObjects.has(firstNormalizedKey)).toBe(true);
      expect(storedObjects.has(firstSourceKey)).toBe(true);

      await agent.delete('/api/users/me/avatar').expect(200);
      const profile = await agent.get('/api/users/me').expect(200);
      const profileUser = parseObject(parseObject(profile.body).user);
      expect(profileUser.avatar).toBeNull();
      expect(profileUser.email).toBe('avatar-replace@example.com');

      const removedAvatar = await prisma.userAvatar.findUnique({
        where: { id: second.uploadId },
      });
      expect(removedAvatar?.status).toBe('deletePending');
      expect(removedAvatar?.deleteAfter?.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
      expect(removedAvatar?.deleteAfter?.getTime()).toBeLessThan(Date.now() + 25 * 60 * 60 * 1000);
      expect(removedAvatar?.storageKey).toBe(secondNormalizedKey);
      expect(removedAvatar?.sourceStorageKey).toBe(secondSourceKey);
      expect(storedObjects.has(secondNormalizedKey)).toBe(true);
      expect(storedObjects.has(secondSourceKey)).toBe(true);

      await avatarService.runCleanup();
      expect(storedObjects.has(firstNormalizedKey)).toBe(true);
      expect(storedObjects.has(firstSourceKey)).toBe(true);
      expect(storedObjects.has(secondNormalizedKey)).toBe(true);
      expect(storedObjects.has(secondSourceKey)).toBe(true);
      expect(
        await prisma.userAvatar.findMany({
          where: { id: { in: [first.uploadId, second.uploadId] } },
        }),
      ).toHaveLength(2);

      const expiredAt = new Date(Date.now() - 1_000);
      await prisma.userAvatar.updateMany({
        where: { id: { in: [first.uploadId, second.uploadId] } },
        data: { deleteAfter: expiredAt },
      });
      await avatarService.runCleanup();

      expect(storedObjects.has(firstNormalizedKey)).toBe(false);
      expect(storedObjects.has(firstSourceKey)).toBe(false);
      expect(storedObjects.has(secondNormalizedKey)).toBe(false);
      expect(storedObjects.has(secondSourceKey)).toBe(false);
      expect(
        await prisma.userAvatar.findMany({
          where: { id: { in: [first.uploadId, second.uploadId] } },
        }),
      ).toHaveLength(0);
      const remainingProfile = await agent.get('/api/users/me').expect(200);
      expect(parseObject(parseObject(remainingProfile.body).user).email).toBe(
        'avatar-replace@example.com',
      );
    });

    it('cleans an expired pending upload from S3 and PostgreSQL', async () => {
      const agent = await registerUser('avatar-pending-cleanup@example.com');
      const uploadResponse = await requestUpload(agent).expect(201);
      const uploadId = parseString(parseObject(parseObject(uploadResponse.body).upload).uploadId);
      const storageKey = await seedUploadedObject(uploadId);

      await prisma.userAvatar.update({
        where: { id: uploadId },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      await avatarService.runCleanup();

      expect(storedObjects.has(storageKey)).toBe(false);
      expect(await prisma.userAvatar.findUnique({ where: { id: uploadId } })).toBeNull();
    });

    it('retries deferred deletion after an S3 failure', async () => {
      const agent = await registerUser('avatar-delete-retry@example.com');
      const first = await uploadAndConfirm(agent, 'avatar-delete-retry@example.com');
      const firstOwner = await prisma.user.findUnique({
        where: { email: 'avatar-delete-retry@example.com' },
        include: { avatar: true },
      });
      const firstAvatar = firstOwner?.avatar;
      if (!firstAvatar?.sourceStorageKey) {
        throw new Error('Expected the first normalized avatar and source upload');
      }
      const normalizedKey = firstAvatar.storageKey;
      const sourceKey = firstAvatar.sourceStorageKey;
      expect(normalizedKey).not.toBe(sourceKey);

      await uploadAndConfirm(agent, 'avatar-delete-retry@example.com');
      await prisma.userAvatar.update({
        where: { id: first.uploadId },
        data: {
          status: 'deletePending',
          deleteAfter: new Date(Date.now() - 1_000),
        },
      });
      deleteFailures.set(normalizedKey, 1);

      await avatarService.runCleanup();

      expect(storedObjects.has(normalizedKey)).toBe(true);
      expect(storedObjects.has(sourceKey)).toBe(true);
      expect(await prisma.userAvatar.findUnique({ where: { id: first.uploadId } })).toMatchObject({
        status: 'deletePending',
      });
      expect(deleteAttempts.get(normalizedKey)).toBe(1);
      expect(deleteAttempts.get(sourceKey)).toBeUndefined();

      const restartedWorker = new UserAvatarService(prisma, app.get(StorageService));
      await restartedWorker.runCleanup();

      expect(storedObjects.has(normalizedKey)).toBe(false);
      expect(storedObjects.has(sourceKey)).toBe(false);
      expect(await prisma.userAvatar.findUnique({ where: { id: first.uploadId } })).toBeNull();
      expect(deleteAttempts.get(normalizedKey)).toBe(2);
      expect(deleteAttempts.get(sourceKey)).toBe(1);
    });

    it('returns an idempotent success when confirming the same upload twice', async () => {
      const agent = await registerUser('avatar-idempotent@example.com');
      const { uploadId, user } = await uploadAndConfirm(agent, 'avatar-idempotent@example.com');

      const repeated = await agent
        .post(`/api/users/me/avatar/uploads/${uploadId}/confirm`)
        .expect(200);

      const repeatedUser = parseObject(parseObject(repeated.body).user);
      expect(stableAvatarProperties(repeatedUser.avatar)).toEqual(
        stableAvatarProperties(user.avatar),
      );
    });
  });
});
