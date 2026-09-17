import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@noto/shared';

import { ApiErrors } from '../lib/errors';
import { toPublicUser } from '../lib/utils';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw ApiErrors.notFound('User not found');
    }

    return toPublicUser(user);
  }

  async updateUsername(actorId: string, userId: string, username: string): Promise<User> {
    if (actorId !== userId) {
      throw ApiErrors.forbidden();
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { username },
      });

      return toPublicUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw ApiErrors.notFound('User not found');
      }

      throw error;
    }
  }
}
