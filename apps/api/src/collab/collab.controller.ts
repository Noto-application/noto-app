import { Controller, Req, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { internalCollabContract } from '@noto/shared/internal';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { toTsRestException } from '../lib/errors';
import type { AuthenticatedRequest } from '../types/auth.types';
import { CollabPersistenceService } from './collab-persistence.service';
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
  constructor(
    private readonly collabService: CollabService,
    private readonly persistence: CollabPersistenceService,
  ) {}

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

  // Persistence (#109) — только сервисный секрет (сессия уже авторизована на
  // хендшейке #108); JWT-пользователь здесь не нужен, collab cookie не шлёт.
  @UseGuards(CollabSecretGuard)
  @TsRestHandler(internalCollabContract.loadDocument)
  loadDocument() {
    return tsRestHandler(internalCollabContract.loadDocument, async ({ params }) => {
      try {
        const doc = await this.persistence.load(params.pageId);
        if (!doc) {
          return { status: 204 as const, body: undefined };
        }
        return { status: 200 as const, body: doc };
      } catch (error) {
        throw toTsRestException(error, internalCollabContract.loadDocument);
      }
    });
  }

  @UseGuards(CollabSecretGuard)
  @TsRestHandler(internalCollabContract.storeDocument)
  storeDocument() {
    return tsRestHandler(internalCollabContract.storeDocument, async ({ params, body }) => {
      try {
        await this.persistence.store(params.pageId, body.state, body.version);
        return { status: 200 as const, body: undefined };
      } catch (error) {
        throw toTsRestException(error, internalCollabContract.storeDocument);
      }
    });
  }
}
