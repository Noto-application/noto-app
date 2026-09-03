import { Spinner } from '@/src/shared/ui/spinner';
import type { AutosaveStatus } from '../model/use-page-autosave';

type AutosaveIndicatorProps = {
  status: AutosaveStatus;
  onRetry: () => void;
};

export function AutosaveIndicator({ status, onRetry }: AutosaveIndicatorProps) {
  return (
    <div aria-live="polite" className="flex items-center gap-1 text-caption text-muted-foreground">
      {status === 'saving' && (
        <>
          <Spinner size="sm" /> Сохранение…
        </>
      )}
      {status === 'saved' && 'Сохранено'}
      {status === 'error' && (
        <>
          Не удалось сохранить
          <button type="button" onClick={onRetry} className="text-primary hover:underline">
            Повторить
          </button>
        </>
      )}
    </div>
  );
}
