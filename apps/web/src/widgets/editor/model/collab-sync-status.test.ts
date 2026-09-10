import { describe, expect, it } from 'vitest';

import { toSyncStatus } from './collab-sync-status';

describe('toSyncStatus', () => {
  it('отказ авторизации приоритетнее всего', () => {
    expect(toSyncStatus({ synced: true, status: 'connected', authFailed: true })).toBe('denied');
  });

  it('synced → synced', () => {
    expect(toSyncStatus({ synced: true, status: 'connected', authFailed: false })).toBe('synced');
  });

  it('разрыв → disconnected, даже если synced ещё true (залипший флаг)', () => {
    expect(toSyncStatus({ synced: false, status: 'disconnected', authFailed: false })).toBe(
      'disconnected',
    );
    expect(toSyncStatus({ synced: true, status: 'disconnected', authFailed: false })).toBe(
      'disconnected',
    );
  });

  it('подключаемся / подключились но не синк → connecting', () => {
    expect(toSyncStatus({ synced: false, status: 'connecting', authFailed: false })).toBe(
      'connecting',
    );
    expect(toSyncStatus({ synced: false, status: 'connected', authFailed: false })).toBe(
      'connecting',
    );
  });
});
