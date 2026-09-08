import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../types/auth.types';
import { CollabSecretGuard } from './collab-secret.guard';
import { CollabService, type CollabAuthorizeResult } from './collab.service';

/**
 * Internal endpoint авторизации Yjs-документа для collab-сервиса (#108).
 * Живёт ВНЕ глобального префикса `/api` (см. app-setup): путь
 * `/internal/collab/authorize`, наружу через публичный proxy не роутится.
 *
 * Порядок гвардов = порядок спеки: сначала сервисный секрет (403), затем
 * пользовательский JWT (401); валидация тела (400) — уже в сервисе.
 */
@Controller('internal/collab')
export class CollabController {
  constructor(private readonly collabService: CollabService) {}

  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CollabSecretGuard, JwtAuthGuard)
  authorize(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<CollabAuthorizeResult> {
    return this.collabService.authorize(request.user.sub, body);
  }
}
