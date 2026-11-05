import { Controller, Req, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { usersContract } from '@noto/shared';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ApiErrors, ApiException, toTsRestException } from '../lib/errors';
import type { AuthenticatedRequest } from '../types/auth.types';
import { UserAvatarService } from './user-avatar.service';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userAvatarService: UserAvatarService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @TsRestHandler(usersContract.me)
  me(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(usersContract.me, async () => {
      try {
        const user = await this.usersService.findById(request.user.sub);
        return { status: 200 as const, body: { user } };
      } catch (error) {
        // findById — поиск ресурса (404). Для /me нет principal → 401, как /auth/me.
        if (error instanceof ApiException && error.code === 'NOT_FOUND') {
          throw toTsRestException(ApiErrors.unauthorized('User not found'), usersContract.me);
        }
        throw toTsRestException(error, usersContract.me);
      }
    });
  }

  @UseGuards(JwtAuthGuard)
  @TsRestHandler(usersContract.update)
  update(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(usersContract.update, async ({ params, body }) => {
      try {
        const user = await this.usersService.updateUsername(
          request.user.sub,
          params.userId,
          body.username,
        );
        return { status: 200 as const, body: { user } };
      } catch (error) {
        throw toTsRestException(error, usersContract.update);
      }
    });
  }

  @UseGuards(JwtAuthGuard)
  @TsRestHandler(usersContract.createAvatarUpload)
  createAvatarUpload(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(usersContract.createAvatarUpload, async ({ body }) => {
      try {
        const result = await this.userAvatarService.createUpload(request.user.sub, body);
        return { status: 201 as const, body: result };
      } catch (error) {
        throw toTsRestException(error, usersContract.createAvatarUpload);
      }
    });
  }

  @UseGuards(JwtAuthGuard)
  @TsRestHandler(usersContract.confirmAvatarUpload)
  confirmAvatarUpload(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(usersContract.confirmAvatarUpload, async ({ params }) => {
      try {
        const user = await this.userAvatarService.confirmUpload(request.user.sub, params.uploadId);
        return { status: 200 as const, body: { user } };
      } catch (error) {
        throw toTsRestException(error, usersContract.confirmAvatarUpload);
      }
    });
  }

  @UseGuards(JwtAuthGuard)
  @TsRestHandler(usersContract.deleteAvatar)
  deleteAvatar(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(usersContract.deleteAvatar, async () => {
      try {
        const user = await this.userAvatarService.remove(request.user.sub);
        return { status: 200 as const, body: { user } };
      } catch (error) {
        throw toTsRestException(error, usersContract.deleteAvatar);
      }
    });
  }
}
