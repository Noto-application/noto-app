import type { onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';
import * as Y from 'yjs';

import type { CollabPersistenceApi } from './collab-persistence-api';
import { DocWriter, type DocWriterDeps } from './collab-doc-writer';

interface PersistenceHooksDeps {
  persistence: CollabPersistenceApi;
  sharedSecret: string;
  logger: NonNullable<DocWriterDeps['logger']>;
  writerOptions?: Pick<DocWriterDeps, 'sleep' | 'backoff'>;
  loadWaitTimeoutMs?: number;
}

const DEFAULT_LOAD_WAIT_TIMEOUT_MS = 5000;

export function createCollabPersistenceHooks({
  persistence,
  sharedSecret,
  logger,
  writerOptions,
  loadWaitTimeoutMs = DEFAULT_LOAD_WAIT_TIMEOUT_MS,
}: PersistenceHooksDeps) {
  const writers = new Map<string, DocWriter>();

  async function loadServerVersion(pageId: string): Promise<number | null> {
    try {
      const result = await persistence.load(pageId, sharedSecret);
      if (result.status === 204) {
        return 0;
      }
      if (result.status === 200 && result.body && typeof result.body === 'object') {
        return (result.body as { version: number }).version;
      }
      return null;
    } catch {
      return null;
    }
  }

  function getWriter(pageId: string): DocWriter {
    let writer = writers.get(pageId);
    if (!writer) {
      writer = new DocWriter({
        store: (state, version) => persistence.store(pageId, state, version, sharedSecret),
        loadVersion: () => loadServerVersion(pageId),
        logger,
        ...writerOptions,
      });
      writers.set(pageId, writer);
    }
    return writer;
  }

  async function onLoadDocument({ documentName, document }: onLoadDocumentPayload) {
    // Предыдущий Y.Doc уже мог быть выгружен после захвата snapshot. Пока writer
    // не закончил PUT, БД отстаёт; новый Y.Doc нельзя создавать из старой версии.
    const writer = writers.get(documentName);
    if (writer) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          writer.flush(),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(
              () => reject(new Error(`pending store timed out for ${documentName}`)),
              loadWaitTimeoutMs,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }

    const result = await persistence.load(documentName, sharedSecret);
    if (result.status === 204) {
      getWriter(documentName).setVersion(0);
      return document;
    }
    if (result.status === 200 && result.body && typeof result.body === 'object') {
      const { state, version } = result.body as { state: string; version: number };
      Y.applyUpdate(document, Buffer.from(state, 'base64'));
      getWriter(documentName).setVersion(version);
      return document;
    }
    throw new Error(`load failed for ${documentName}: ${result.status}`);
  }

  function onStoreDocument({ documentName, document }: onStoreDocumentPayload) {
    const state = Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64');
    getWriter(documentName).save(state);
    return Promise.resolve();
  }

  function flushWriters(): Promise<void[]> {
    return Promise.all([...writers.values()].map((writer) => writer.flush()));
  }

  return { onLoadDocument, onStoreDocument, flushWriters };
}
