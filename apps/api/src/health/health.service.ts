import { Injectable } from '@nestjs/common';

import type { HealthResponse } from '../types/health.types';

@Injectable()
export class HealthService {
  check(): HealthResponse {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
