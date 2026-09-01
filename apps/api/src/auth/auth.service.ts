import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type { User as UserRecord } from '@prisma/client';
import type { AuthCredentials, User } from '@noto/shared';

import type { Env } from '../config/env.schema';
import { ApiErrors } from '../lib/errors';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthResult, AuthTokens, JwtRefreshPayload } from '../types/auth.types';
import { toPublicUser, ttlToSeconds } from '../lib/utils';
import { PasswordHasherService } from './password-hasher.service';
import { RedisRefreshTokenStore } from './refresh-token.store';

/** Имя дефолтного проекта, создаваемого при регистрации (issue #88). */
const DEFAULT_PROJECT_NAME = 'Мой проект';

@Injectable()
export class AuthService {
  private dummyPasswordHash: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly refreshTokenStore: RedisRefreshTokenStore,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async register(credentials: AuthCredentials): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: credentials.email },
    });

    if (existing) {
      throw ApiErrors.emailTaken();
    }

    const passwordHash = await this.passwordHasher.hash(credentials.password);

    let user: UserRecord;
    try {
      // Транзакция: у нового пользователя всегда есть воркспейс — создаём
      // дефолтный проект и owner-membership вместе с User (issue #88, ADR-011).
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: credentials.email,
            passwordHash,
          },
        });

        await tx.project.create({
          data: {
            name: DEFAULT_PROJECT_NAME,
            members: { create: { userId: created.id, role: 'owner' } },
          },
        });

        return created;
      });
    } catch (error) {
      // Гонка: параллельный register с тем же email прошёл findUnique выше и
      // вставился первым — уникальный индекс отдаёт P2002. Без этого маппинга
      // ошибка не ApiException, фильтр её не ловит и клиент получает 500
      // вместо 409 EMAIL_TAKEN.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw ApiErrors.emailTaken();
      }
      throw error;
    }

    const tokens = await this.issueTokenPair(user.id);
    return { user: toPublicUser(user), tokens };
  }

  async login(credentials: AuthCredentials): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: credentials.email },
    });

    const hashToVerify = user?.passwordHash ?? (await this.getDummyPasswordHash());
    const valid = await this.passwordHasher.verify(credentials.password, hashToVerify);

    if (!user || !valid) {
      throw ApiErrors.invalidCredentials();
    }

    const tokens = await this.issueTokenPair(user.id);
    return { user: toPublicUser(user), tokens };
  }

  async refresh(refreshToken: string | undefined): Promise<{ tokens: AuthTokens }> {
    if (!refreshToken) {
      throw ApiErrors.unauthorized('Refresh token is missing');
    }

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw ApiErrors.unauthorized('Refresh token is invalid or expired');
    }

    const isActive = await this.refreshTokenStore.isActive(payload.sub, payload.jti);
    if (!isActive) {
      throw ApiErrors.unauthorized('Refresh token is invalid or expired');
    }

    const tokens = await this.rotateRefreshToken(payload.sub, payload.jti);
    return { tokens };
  }

  async logout(refreshToken: string | undefined, accessToken?: string): Promise<void> {
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshToken, {
          secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        });
        await this.refreshTokenStore.revoke(payload.sub, payload.jti);
        return;
      } catch {
        // Падать не нужно — пробуем access ниже или завершаем идемпотентно.
      }
    }

    if (accessToken) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sub: string }>(accessToken);
        await this.refreshTokenStore.revokeAllForUser(payload.sub);
      } catch {
        // Идемпотентно: без валидной сессии всё равно успех.
      }
    }
  }

  async getMe(userId: string): Promise<{ user: User }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw ApiErrors.unauthorized('User not found');
    }

    return { user: toPublicUser(user) };
  }

  private async issueTokenPair(userId: string): Promise<AuthTokens> {
    const jti = randomUUID();
    const accessToken = await this.jwtService.signAsync({ sub: userId });
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti },
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_TTL', { infer: true }),
      },
    );

    await this.refreshTokenStore.store(
      userId,
      jti,
      ttlToSeconds(this.config.get('JWT_REFRESH_TTL', { infer: true })),
    );

    return { accessToken, refreshToken, refreshJti: jti, userId };
  }

  private async rotateRefreshToken(userId: string, oldJti: string): Promise<AuthTokens> {
    const jti = randomUUID();
    const accessToken = await this.jwtService.signAsync({ sub: userId });
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti },
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_TTL', { infer: true }),
      },
    );

    await this.refreshTokenStore.replace(
      userId,
      oldJti,
      jti,
      ttlToSeconds(this.config.get('JWT_REFRESH_TTL', { infer: true })),
    );

    return { accessToken, refreshToken, refreshJti: jti, userId };
  }

  private async getDummyPasswordHash(): Promise<string> {
    if (!this.dummyPasswordHash) {
      this.dummyPasswordHash = await this.passwordHasher.hash('dummy-timing-placeholder');
    }

    return this.dummyPasswordHash;
  }
}
