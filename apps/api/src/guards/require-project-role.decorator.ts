import { SetMetadata } from '@nestjs/common';
import type { ProjectRole } from '@prisma/client';

export const REQUIRE_PROJECT_ROLE_KEY = 'requireProjectRole';

/** Минимальная роль участника для эндпоинта (ADR-011). Читает ProjectAccessGuard. */
export const RequireProjectRole = (role: ProjectRole) =>
  SetMetadata(REQUIRE_PROJECT_ROLE_KEY, role);
