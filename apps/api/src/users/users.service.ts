import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@noto/shared';

import { ApiErrors } from '../lib/errors';
import { StorageService } from '../storage/storage.service';
import { toPublicUserWithAvatar } from '../lib/utils/to-public-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findById(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { avatar: true },
    });

    if (!user) {
      throw ApiErrors.notFound('User not found');
    }

    return toPublicUserWithAvatar(user, (key) => this.storage.createReadUrl(key));
  }

  async updateUsername(actorId: string, userId: string, username: string): Promise<User> {
    if (actorId !== userId) {
      throw ApiErrors.forbidden();
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { username },
        include: { avatar: true },
      });

      return toPublicUserWithAvatar(user, (key) => this.storage.createReadUrl(key));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw ApiErrors.notFound('User not found');
      }

      throw error;
    }
  }
}
