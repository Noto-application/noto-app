import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Spinner } from '@/src/shared/ui/spinner';
import type { CollabSyncStatus } from '../model/collab-sync-status';

// Задержка перед показом «Syncing…», чтобы бейдж не мигал на каждом символе,
// пока правка ждёт подтверждения сервером.
const SYNCING_HINT_DELAY_MS = 600;

type CollabSyncIndicatorProps = {
  status: CollabSyncStatus;
  hasUnsyncedChanges?: boolean;
};

const badgeClass =
  'mb-3 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-caption text-muted-foreground';

/**
 * Индикатор состояния collab (#110). При живом соединении бейджа нет; когда
 * правка не подтверждена сервером дольше задержки — ненавязчивый «Syncing…»
 * (со спиннером, не WifiOff — соединение активно). Разрыв/подключение/отказ —
 * отдельные состояния.
 */
export function CollabSyncIndicator({ status, hasUnsyncedChanges = false }: CollabSyncIndicatorProps) {
  const pendingSync = status === 'synced' && hasUnsyncedChanges;
  const showSyncing = useDelayedFlag(pendingSync, SYNCING_HINT_DELAY_MS);

  // Норма: подключены и всё подтверждено — ничего не показываем.
  if (status === 'synced' && !showSyncing) {
    return null;
  }

  if (status === 'synced') {
    return (
      <div role="status" aria-label="Collaboration sync" className={badgeClass}>
        <Spinner size="sm" />
        <span>Syncing…</span>
      </div>
    );
  }

  return (
    <div role="status" aria-label="Collaboration connection" className={badgeClass}>
      {status === 'connecting' ? (
        <Spinner size="sm" />
      ) : (
        <WifiOff aria-hidden="true" className="size-3.5" />
      )}
      <span>
        {status === 'connecting' && 'Connecting…'}
        {status === 'disconnected' && 'Reconnecting…'}
        {status === 'denied' && 'Access denied'}
      </span>
    </div>
  );
}

/** true, если `active` держится дольше `delayMs` (иначе не мигаем). */
function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс флага при снятии условия
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return shown;
}
