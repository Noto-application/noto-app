import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import type { HealthResponse } from '../types/health.types';

/**
 * Health-check вне глобального префикса /api — так его ждут healthcheck'и
 * Docker и оркестратора (см. main.ts, setGlobalPrefix exclude).
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthResponse {
    return this.healthService.check();
  }
}
