/**
 * Unit-тесты AuthService — test-first (RFC-008).
 * Реализация: auth.service.ts (отдельная задача после ревью тестов).
 *
 * PasswordHasher мокается — @node-rs/argon2 в unit-тестах не нужен.
 */
import { Prisma } from '@prisma/client';

import type { Env } from '../config/env.schema';
import { ApiException } from '../lib/errors';
import type { AuthTokens, PasswordHasher, RefreshTokenStore } from '../types/auth.types';
import { AuthService } from './auth.service';

/** Дефолт grace-окна (#50); сервис передаёт его в store. */
const REFRESH_GRACE_TTL_SECONDS = 10;

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    project: {
      create: jest.fn(),
    },
    // register оборачивает создание в транзакцию; реализация — в beforeEach
    // (нельзя ссылаться на prisma внутри его же инициализатора).
    $transaction: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const config = {
    get: jest.fn((key: keyof Env) => {
      const values: Partial<Record<keyof Env, string>> = {
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_REFRESH_TTL: '7d',
      };
      return values[key];
    }),
  };

  const storeMock = jest.fn() as jest.MockedFunction<RefreshTokenStore['store']>;
  const replaceMock = jest.fn() as jest.MockedFunction<RefreshTokenStore['replace']>;
  const rotateWithGraceMock = jest.fn() as jest.MockedFunction<
    RefreshTokenStore['rotateWithGrace']
  >;
  const revokeMock = jest.fn() as jest.MockedFunction<RefreshTokenStore['revoke']>;
  const revokeAllForUserMock = jest.fn() as jest.MockedFunction<
    RefreshTokenStore['revokeAllForUser']
  >;
  const isActiveMock = jest.fn() as jest.MockedFunction<RefreshTokenStore['isActive']>;

  const refreshTokenStore: jest.Mocked<RefreshTokenStore> = {
    store: storeMock,
    replace: replaceMock,
    rotateWithGrace: rotateWithGraceMock,
    revoke: revokeMock,
    revokeAllForUser: revokeAllForUserMock,
    isActive: isActiveMock,
  };

  const hashMock = jest.fn() as jest.MockedFunction<PasswordHasher['hash']>;
  const verifyMock = jest.fn() as jest.MockedFunction<PasswordHasher['verify']>;

  const passwordHasher: jest.Mocked<PasswordHasher> = {
    hash: hashMock,
    verify: verifyMock,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Прокидываем тот же мок как tx: tx.user.create === prisma.user.create,
    // поэтому моки кейсов остаются валидны.
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));

    service = new AuthService(
      prisma as never,
      jwtService as never,
      config as never,
      refreshTokenStore as never,
      passwordHasher,
    );
  });

  describe('register', () => {
    it('создаёт пользователя и выдаёт токены', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      hashMock.mockResolvedValue('hash');
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hash',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.register({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.user).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(result.tokens.accessToken).toBe('access-token');
      expect(storeMock).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
        604_800,
      );
    });

    it('бросает EMAIL_TAKEN если email занят', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ email: 'user@example.com', password: 'password123' }),
      ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('маппит гонку (P2002 на create) в EMAIL_TAKEN, а не 500', async () => {
      // findUnique прошёл (null), но параллельный register вставился первым —
      // create упирается в уникальный индекс.
      prisma.user.findUnique.mockResolvedValue(null);
      hashMock.mockResolvedValue('hash');
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.register({ email: 'user@example.com', password: 'password123' }),
      ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    });

    it('пробрасывает прочие ошибки create как есть', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      hashMock.mockResolvedValue('hash');
      prisma.user.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.register({ email: 'user@example.com', password: 'password123' }),
      ).rejects.toThrow('db down');
    });
  });

  describe('login', () => {
    it('бросает INVALID_CREDENTIALS при неверном пароле', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      verifyMock.mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong-pass' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('бросает INVALID_CREDENTIALS для несуществующего email с тем же сообщением', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      hashMock.mockResolvedValue('dummy-hash');
      verifyMock.mockResolvedValue(false);

      await expect(
        service.login({ email: 'missing@example.com', password: 'password123' }),
      ).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('вызывает verify пароля даже если пользователь не найден (timing-safe)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      hashMock.mockResolvedValue('dummy-hash');
      verifyMock.mockResolvedValue(false);

      await expect(
        service.login({ email: 'missing@example.com', password: 'password123' }),
      ).rejects.toThrow(ApiException);

      expect(verifyMock).toHaveBeenCalledWith(
        'password123',
        'dummy-hash',
      );
    });
  });

  describe('refresh', () => {
    it('бросает UNAUTHORIZED без refresh cookie', async () => {
      await expect(service.refresh(undefined)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('бросает UNAUTHORIZED при невалидной подписи', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(service.refresh('bad.token.value')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('бросает UNAUTHORIZED если jti отсутствует в Redis', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-old' });
      rotateWithGraceMock.mockResolvedValue({ kind: 'missing' });

      await expect(service.refresh('valid.token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
      expect(rotateWithGraceMock).toHaveBeenCalled();
    });

    it('ротирует refresh jti при успешном refresh', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        jti: 'jti-old',
        persistent: false,
      });
      jwtService.signAsync.mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh');
      rotateWithGraceMock.mockResolvedValue({ kind: 'rotated' });

      const result = await service.refresh('valid.token');

      expect(rotateWithGraceMock).toHaveBeenCalledWith(
        'user-1',
        'jti-old',
        expect.any(String),
        expect.objectContaining({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          userId: 'user-1',
          persistent: false,
        }),
        604_800,
        REFRESH_GRACE_TTL_SECONDS,
      );
      expect(result.tokens.accessToken).toBe('new-access');
      expect(result.tokens.refreshToken).toBe('new-refresh');
    });

    it('при гонке в grace-окне отдаёт кэшированную пару, а не только что подписанную', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        jti: 'jti-old',
        persistent: true,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('speculative-access')
        .mockResolvedValueOnce('speculative-refresh');
      const cached: AuthTokens = {
        accessToken: 'cached-access',
        refreshToken: 'cached-refresh',
        refreshJti: 'jti-winner',
        userId: 'user-1',
        persistent: true,
      };
      rotateWithGraceMock.mockResolvedValue({ kind: 'replay', tokens: cached });

      const result = await service.refresh('valid.token');

      expect(result.tokens).toEqual(cached);
    });
  });

  describe('logout', () => {
    it('удаляет jti из Redis при валидном refresh', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });

      await service.logout('refresh-token');

      expect(revokeMock).toHaveBeenCalledWith('user-1', 'jti-1');
    });

    it('отзывает все refresh по access, если refresh cookie недоступен (Path=/api/auth/refresh)', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });

      await service.logout(undefined, 'access-token');

      expect(revokeAllForUserMock).toHaveBeenCalledWith('user-1');
    });

    it('идемпотентен без cookie', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
      expect(revokeMock).not.toHaveBeenCalled();
      expect(revokeAllForUserMock).not.toHaveBeenCalled();
    });
  });
});
