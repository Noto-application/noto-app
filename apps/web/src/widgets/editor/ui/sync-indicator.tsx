import { WifiOff } from 'lucide-react';

import { Spinner } from '@/src/shared/ui/spinner';
import type { CollabSyncStatus } from '../model/collab-sync-status';

type CollabSyncIndicatorProps = {
  status: CollabSyncStatus;
  hasUnsyncedChanges?: boolean;
};

/** Базовый индикатор синка collab (#110): подключение / готово / разрыв. */
export function CollabSyncIndicator({ status, hasUnsyncedChanges = false }: CollabSyncIndicatorProps) {
  if (status === 'synced') {
    return null;
  }

  return (
    <div
      role="status"
      aria-label="Collaboration connection"
      className="mb-3 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-caption text-muted-foreground"
    >
      {status === 'connecting' ? (
        <Spinner size="sm" />
      ) : (
        <WifiOff aria-hidden="true" className="size-3.5" />
      )}
      <span>
        {status === 'connecting' && 'Connecting…'}
        {status === 'disconnected' && 'Reconnecting…'}
        {status === 'denied' && 'Access denied'}
        {hasUnsyncedChanges && status !== 'denied' && (
          <span className="ml-2">Changes haven’t been sent yet. Keep this page open.</span>
        )}
      </span>
    </div>
  );
}
