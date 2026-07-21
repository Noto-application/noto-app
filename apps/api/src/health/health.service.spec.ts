import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get(HealthService);
  });

  it('возвращает статус ok', () => {
    expect(service.check().status).toBe('ok');
  });

  it('возвращает uptime и валидный ISO timestamp', () => {
    const result = service.check();

    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
