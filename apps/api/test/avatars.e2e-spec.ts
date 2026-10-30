import { Readable } from 'node:stream';
import type { Server } from 'node:http';
import request from 'supertest';
import type { S3Client } from '@aws-sdk/client-s3';

import { S3_CLIENT } from '../src/storage/storage.constants';
import { createTestApp, resetAuthState } from './helpers/test-app';

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_AVATAR_SIZE = 256 * 1024;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=',
  'base64',
);

interface StoredObject {
  body: Buffer;
  contentType: string;
  size: number;
}

type JsonObject = Record<string, unknown>;

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

describe('User avatars (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];
  let storedObject: StoredObject;
  let s3Send: jest.SpyInstance;
  const s3Response = {
    get Body(): Readable {
      return Readable.from([storedObject.body]);
    },
    get ContentLength(): number {
      return storedObject.size;
    },
    get ContentType(): string {
      return storedObject.contentType;
    },
  };

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();

    const s3Client = app.get<S3Client>(S3_CLIENT);
    s3Send = jest.spyOn(s3Client, 'send').mockResolvedValue(s3Response as never);
  });

  beforeEach(async () => {
    await resetAuthState(prisma, redis);
    storedObject = { body: PNG, contentType: 'image/png', size: PNG.length };
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

      const { uploadId, user } = await uploadAndConfirm(agent, email);
      const avatar = parseObject(user.avatar);

      const avatarUrl = parseString(avatar.url);
      expect(avatarUrl).not.toBe('');
      expect(avatar.contentType).toBe('image/webp');
      expect(parseNumber(avatar.size)).toBeLessThanOrEqual(MAX_AVATAR_SIZE);
      expect(avatarUrl).not.toContain(uploadId);
      const profile = await agent.get('/api/users/me').expect(200);
      const profileUser = parseObject(parseObject(profile.body).user);
      expect(profileUser.avatar).toEqual(avatar);
      expect(profileUser).not.toHaveProperty('passwordHash');
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
      storedObject = {
        body: PNG,
        contentType: 'image/png',
        size: MAX_UPLOAD_SIZE + 1,
      };

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
      storedObject = {
        body: Buffer.from('not an image'),
        contentType: 'image/jpeg',
        size: Buffer.byteLength('not an image'),
      };

      await agent
        .post(`/api/users/me/avatar/uploads/${uploadId}/confirm`)
        .expect(400);
      const profile = await agent.get('/api/users/me').expect(200);
      expect(parseObject(parseObject(profile.body).user).avatar).toBeNull();
    });

    it('replaces an avatar and removes it without deleting the user profile', async () => {
      const agent = await registerUser('avatar-replace@example.com');
      const first = await uploadAndConfirm(agent, 'avatar-replace@example.com');
      const firstAvatar = first.user.avatar;

      const second = await uploadAndConfirm(agent, 'avatar-replace@example.com');
      expect(second.user.avatar).not.toEqual(firstAvatar);

      await agent.delete('/api/users/me/avatar').expect(200);
      const profile = await agent.get('/api/users/me').expect(200);
      const profileUser = parseObject(parseObject(profile.body).user);
      expect(profileUser.avatar).toBeNull();
      expect(profileUser.email).toBe('avatar-replace@example.com');
    });

    it('returns an idempotent success when confirming the same upload twice', async () => {
      const agent = await registerUser('avatar-idempotent@example.com');
      const { uploadId, user } = await uploadAndConfirm(agent, 'avatar-idempotent@example.com');

      const repeated = await agent
        .post(`/api/users/me/avatar/uploads/${uploadId}/confirm`)
        .expect(200);

      expect(parseObject(parseObject(repeated.body).user).avatar).toEqual(user.avatar);
    });
  });
});
