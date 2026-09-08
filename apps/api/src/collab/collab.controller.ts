import { Controller, Req, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { internalCollabContract } from '@noto/shared/internal';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { toTsRestException } from '../lib/errors';
import type { AuthenticatedRequest } from '../types/auth.types';
import { CollabSecretGuard } from './collab-secret.guard';
import { CollabService } from './collab.service';

/**
 * Internal endpoint авторизации Yjs-документа (#108). Контракт —
 * @noto/shared/internal (общий с apps/collab), вне публичного apiContract.
 * Путь `/internal/collab/authorize` исключён из глобального /api-префикса
 * (см. app-setup), наружу через Caddy не роутится.
 *
 * Порядок гвардов = порядок спеки: сервисный секрет (403) → JWT (401);
 * валидацию тела (400) делает ts-rest до хендлера.
 */
@Controller()
export class CollabController {
  constructor(private readonly collabService: CollabService) {}

  @UseGuards(CollabSecretGuard, JwtAuthGuard)
  @TsRestHandler(internalCollabContract.authorize)
  authorize(@Req() request: AuthenticatedRequest) {
    return tsRestHandler(internalCollabContract.authorize, async ({ body }) => {
      try {
        const result = await this.collabService.authorize(request.user.sub, body.documentName);
        return { status: 200 as const, body: result };
      } catch (error) {
        throw toTsRestException(error, internalCollabContract.authorize);
      }
    });
  }
}
