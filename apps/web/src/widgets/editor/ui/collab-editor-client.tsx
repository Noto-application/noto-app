'use client';

import '@blocknote/mantine/style.css';

import { withCollaboration } from '@blocknote/core/yjs';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';

import { useCurrentUser } from '@/src/entities/user';
import { buildCollabUrl } from '../lib/collab-url';
import { deriveCollabUser, type CollabUser } from '../lib/collab-user';
import { toSyncStatus, type CollabSyncStatus } from '../model/collab-sync-status';
import { CollabSyncIndicator } from './sync-indicator';

// Пока presence нет — метка для незагруженного пользователя. Курсоры вне scope.
const FALLBACK_COLLAB_USER: CollabUser = { name: 'Аноним', color: '#6b7280' };

type CollabEditorClientProps = {
  pageId: string;
};

type Connection = {
  doc: Y.Doc;
  provider: HocuspocusProvider;
};

/**
 * Редактор поверх общего Yjs-документа (#110). Грузится только на клиенте (через
 * `next/dynamic`, ssr:false), поэтому `window` безопасен. Контент идёт только
 * через Yjs (ADR-005) — REST-автосейв не подключаем.
 */
export function CollabEditorClient({ pageId }: CollabEditorClientProps) {
  const { data: user } = useCurrentUser();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [status, setStatus] = useState<CollabSyncStatus>('connecting');
  // Первый успешный синк: редактор доступен только после него (иначе правки до
  // получения документа/результата авторизации потеряются при отказе).
  const [hasSynced, setHasSynced] = useState(false);
  // Есть локальные правки, не подтверждённые сервером (провайдер сбрасывает по
  // подтверждению). Ведём отдельно от статуса: после синка `synced` остаётся
  // true, а новые правки до ack сервером — риск потери при закрытии.
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);

  // Создание ресурсов и их уничтожение — в одном эффекте (симметрично), иначе
  // повтор эффектов в dev Strict Mode подписался бы на уже уничтоженный
  // провайдер. Роут ремонтит компонент по `key={pageId}`.
  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: buildCollabUrl(window.location.origin),
      name: pageId,
      document: doc,
      // Запускает auth-обмен Hocuspocus 2.x; сервер проверяет HttpOnly cookie,
      // а не этот публичный маркер. Без token клиент не отправляет Auth message.
      token: 'cookie-auth',
    });

    let synced = false;
    let connStatus = 'connecting';
    let authFailed = false;
    const update = () => setStatus(toSyncStatus({ synced, status: connStatus, authFailed }));

    const onStatus = (event: { status: string }) => {
      connStatus = event.status;
      update();
    };
    // Hocuspocus шлёт `synced` и при закрытии соединения с `{ state: false }` —
    // берём фактический флаг, а не считаем любое событие успехом.
    const onSynced = (event: { state: boolean }) => {
      synced = event.state;
      if (event.state) {
        setHasSynced(true);
      }
      update();
    };
    const onAuthFailed = () => {
      authFailed = true;
      update();
    };
    const onUnsyncedChanges = (count: number) => {
      setHasUnsyncedChanges(count > 0);
    };

    provider.on('status', onStatus);
    provider.on('synced', onSynced);
    provider.on('authenticationFailed', onAuthFailed);
    provider.on('unsyncedChanges', onUnsyncedChanges);

    // Провайдер создаётся здесь (Strict-Mode-safe: симметрично cleanup) и нужен
    // для рендера редактора — сохранение его в state тут намеренно.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnection({ doc, provider });

    return () => {
      provider.off('status', onStatus);
      provider.off('synced', onSynced);
      provider.off('authenticationFailed', onAuthFailed);
      provider.off('unsyncedChanges', onUnsyncedChanges);
      provider.destroy();
      doc.destroy();
      setConnection(null);
    };
  }, [pageId]);

  // Есть неподтверждённые сервером правки → при закрытии вкладки они потеряются
  // (офлайн-очередь вне scope). Смотрим на unsyncedChanges, а не на статус:
  // после синка соединение `synced`, но свежая правка ещё не подтверждена.
  useEffect(() => {
    if (!hasUnsyncedChanges) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsyncedChanges]);

  if (status === 'denied') {
    return <p className="text-body text-muted-foreground">Нет доступа к документу.</p>;
  }

  if (!connection) {
    return <CollabSyncIndicator status="connecting" />;
  }

  return (
    <BoundEditor
      doc={connection.doc}
      provider={connection.provider}
      user={user ? deriveCollabUser(user) : FALLBACK_COLLAB_USER}
      status={status}
      hasUnsyncedChanges={hasUnsyncedChanges}
      editable={hasSynced}
    />
  );
}

type BoundEditorProps = {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  user: CollabUser;
  status: CollabSyncStatus;
  hasUnsyncedChanges: boolean;
  editable: boolean;
};

/**
 * Редактор, привязанный к готовому провайдеру. Отдельный компонент, чтобы хук
 * `useCreateBlockNote` вызывался только когда провайдер уже создан. Ввод
 * разрешаем лишь после первого синка (`editable`); офлайн-правки после успешного
 * подключения остаются доступны.
 */
function BoundEditor({ doc, provider, user, status, editable, hasUnsyncedChanges }: BoundEditorProps) {
  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        // BlockNote нужен только awareness провайдера (у HocuspocusProvider он
        // `| null`, опция ждёт `| undefined`).
        provider: { awareness: provider.awareness ?? undefined },
        fragment: doc.getXmlFragment('document-store'),
        user,
      },
    }),
    [provider, doc],
  );

  return (
    <>
      <CollabSyncIndicator status={status} hasUnsyncedChanges={hasUnsyncedChanges} />
      <BlockNoteView editor={editor} editable={editable} />
    </>
  );
}
