import { loadCollabConfig } from './collab-env';

/**
 * Unit конфига collab — test-first (ADR-013), контракт из
 * docs/specs/108-collab-auth.spec.md.
 *
 * Пустой/отсутствующий COLLAB_SHARED_SECRET запрещает старт: валидация падает
 * при загрузке конфига, а не на первом WS-коннекте. Красные до реализации.
 */

const validEnv = {
  PORT: '5000',
  COLLAB_SHARED_SECRET: 'service-secret',
  COLLAB_ALLOWED_ORIGINS: 'http://localhost:3000',
  API_INTERNAL_URL: 'http://localhost:4000',
};

describe('loadCollabConfig', () => {
  it('валидный env → конфиг с непустым секретом и allowlist', () => {
    const config = loadCollabConfig(validEnv);
    expect(config.sharedSecret).toBe('service-secret');
    expect(config.allowedOrigins).toEqual(['http://localhost:3000']);
  });

  it('COLLAB_SHARED_SECRET пустой → бросает (старт запрещён)', () => {
    expect(() => loadCollabConfig({ ...validEnv, COLLAB_SHARED_SECRET: '' })).toThrow();
  });

  it('COLLAB_SHARED_SECRET отсутствует → бросает', () => {
    const { COLLAB_SHARED_SECRET, ...withoutSecret } = validEnv;
    void COLLAB_SHARED_SECRET;
    expect(() => loadCollabConfig(withoutSecret)).toThrow();
  });

  it('несколько origin через запятую → список', () => {
    const config = loadCollabConfig({
      ...validEnv,
      COLLAB_ALLOWED_ORIGINS: 'http://localhost:3000,https://app.noto.example',
    });
    expect(config.allowedOrigins).toEqual([
      'http://localhost:3000',
      'https://app.noto.example',
    ]);
  });
});
