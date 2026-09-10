/** Статус collab-соединения для индикатора (#110). */
export type CollabSyncStatus = 'connecting' | 'synced' | 'disconnected' | 'denied';

/**
 * Маппинг состояния HocuspocusProvider в статус индикатора.
 * Приоритет: `denied` (отказ авторизации) → `disconnected` (разрыв важнее
 * возможного «залипшего» synced=true) → `synced` → `connecting` (подключаемся /
 * подключились, но ещё не синхронизированы).
 */
export function toSyncStatus(params: {
  synced: boolean;
  status: string;
  authFailed: boolean;
}): CollabSyncStatus {
  if (params.authFailed) {
    return 'denied';
  }
  if (params.status === 'disconnected') {
    return 'disconnected';
  }
  if (params.synced) {
    return 'synced';
  }
  return 'connecting';
}
