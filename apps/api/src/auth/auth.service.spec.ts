/**
 * Unit-тесты AuthService — test-first (RFC-008).
 * Реализация: auth.service.ts (отдельная задача после ревью тестов).
 *
 * PasswordHasher мокается — @node-rs/argon2 в unit-тестах не нужен.
 */
import type { Env } from '../config/env.schema';
import { AuthService, AuthServiceError } from './auth.service';

interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

interface RefreshTokenStore {
  store(userId: string, jti: string, ttlSeconds: number): Promise<void>;
  replace(userId: string, oldJti: string, newJti: string, ttlSeconds: number): Promise<void>;
  revoke(userId: string, jti: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  isActive(userId: string, jti: string): Promise<boolean>;
}

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
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

  const refreshTokenStore: jest.Mocked<RefreshTokenStore> = {
    store: jest.fn(),
    replace: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
    isActive: jest.fn(),
  };

  const passwordHasher: jest.Mocked<PasswordHasher> = {
    hash: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AuthService(
      prisma as never,
      jwtService as never,
      config as never,
      refreshTokenStore,
      passwordHasher as never,
    );
  });

  describe('register', () => {
    it('создаёт пользователя и выдаёт токены', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      passwordHasher.hash.mockResolvedValue('hash');
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
      expect(refreshTokenStore.store).toHaveBeenCalledWith(
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
      passwordHasher.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong-pass' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('бросает INVALID_CREDENTIALS для несуществующего email с тем же сообщением', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      passwordHasher.hash.mockResolvedValue('dummy-hash');
      passwordHasher.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'missing@example.com', password: 'password123' }),
      ).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('вызывает verify пароля даже если пользователь не найден (timing-safe)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      passwordHasher.hash.mockResolvedValue('dummy-hash');
      passwordHasher.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'missing@example.com', password: 'password123' }),
      ).rejects.toThrow(AuthServiceError);

      expect(passwordHasher.verify).toHaveBeenCalledWith(
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
      refreshTokenStore.isActive.mockResolvedValue(false);

      await expect(service.refresh('valid.token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('ротирует refresh jti при успешном refresh', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-old' });
      refreshTokenStore.isActive.mockResolvedValue(true);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');

      const result = await service.refresh('valid.token');

      expect(refreshTokenStore.replace).toHaveBeenCalledWith(
        'user-1',
        'jti-old',
        expect.any(String),
        604_800,
      );
      expect(result.tokens.accessToken).toBe('new-access');
    });
  });

  describe('logout', () => {
    it('удаляет jti из Redis при валидном refresh', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });

      await service.logout('refresh-token');

      expect(refreshTokenStore.revoke).toHaveBeenCalledWith('user-1', 'jti-1');
    });

    it('отзывает все refresh по access, если refresh cookie недоступен (Path=/api/auth/refresh)', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });

      await service.logout(undefined, 'access-token');

      expect(refreshTokenStore.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('идемпотентен без cookie', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
      expect(refreshTokenStore.revoke).not.toHaveBeenCalled();
      expect(refreshTokenStore.revokeAllForUser).not.toHaveBeenCalled();
    });
  });
});
