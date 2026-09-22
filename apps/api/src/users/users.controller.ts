import { Controller, Req, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { usersContract } from '@noto/shared';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ApiErrors, ApiException, toTsRestException } from '../lib/errors';
import type { AuthenticatedRequest } from '../types/auth.types';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}
