import { Hocuspocus } from '@hocuspocus/server';
import * as Y from 'yjs';

import { createCollabPersistenceHooks } from './collab-persistence-hooks';
import type { CollabPersistenceApi } from './collab-persistence-api';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('collab persistence lifecycle', () => {
  it('сохраняет правки A при отключении и повторной загрузке B во время retry', async () => {
    const pageId = '11111111-1111-1111-1111-111111111111';
    const base = new Y.Doc();
    base.getMap('content').set('base', true);
    let storedState = Buffer.from(Y.encodeStateAsUpdate(base)).toString('base64');
    let storedVersion = 1;
    base.destroy();

    let available = false;
    let failedStores = 0;
    let loadCalls = 0;
    const firstFailure = deferred();
    const retry = deferred();
    const unloaded = deferred();
    const api: CollabPersistenceApi = {
      load() {
        loadCalls += 1;
        return Promise.resolve({ status: 200, body: { state: storedState, version: storedVersion } });
      },
      store(_pageId, state, version) {
        if (!available) {
          failedStores += 1;
          firstFailure.resolve();
          return Promise.resolve({ status: 503 });
        }
        if (version <= storedVersion) {
          return Promise.resolve({ status: 409 });
        }
        storedState = state;
        storedVersion = version;
        return Promise.resolve({ status: 200 });
      },
    };
    const hooks = createCollabPersistenceHooks({
      persistence: api,
      sharedSecret: 'secret',
      logger: {},
      writerOptions: { sleep: () => retry.promise },
    });
    const server = new Hocuspocus({
      quiet: true,
      stopOnSignals: false,
      onLoadDocument: hooks.onLoadDocument,
      onStoreDocument: hooks.onStoreDocument,
      afterUnloadDocument: () => { unloaded.resolve(); return Promise.resolve(); },
    });

    const a = await server.openDirectConnection(pageId);
    await a.transact((document) => { document.getMap('content').set('a', true); });
    await firstFailure.promise;
    await a.disconnect();
    await unloaded.promise;
    expect(server.documents.has(pageId)).toBe(false);
    expect(failedStores).toBeGreaterThan(0);

    // B открывает тот же документ, пока snapshot A ещё не попал в БД.
    const bOpening = server.openDirectConnection(pageId);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const loadsBeforeRecovery = loadCalls;
    available = true;
    retry.resolve();
    const b = await bOpening;
    await b.transact((document) => { document.getMap('content').set('b', true); });
    await b.disconnect();
    await hooks.flushWriters();

    const persisted = new Y.Doc();
    Y.applyUpdate(persisted, Buffer.from(storedState, 'base64'));
    expect(loadsBeforeRecovery).toBe(1); // B ещё не читал устаревшую БД
    expect(persisted.getMap('content').toJSON()).toEqual({ base: true, a: true, b: true });
    persisted.destroy();
  });

  it('при долгом retry отклоняет повторную загрузку и сохраняет данные после восстановления API', async () => {
    const pageId = '22222222-2222-2222-2222-222222222222';
    const retry = deferred();
    const firstFailure = deferred();
    const unloaded = deferred();
    let available = false;
    let loadCalls = 0;
    let storedState: string | undefined;
    let storedVersion = 0;
    const api: CollabPersistenceApi = {
      load() {
        loadCalls += 1;
        return Promise.resolve(storedState
          ? { status: 200, body: { state: storedState, version: storedVersion } }
          : { status: 204, body: undefined });
      },
      store(_pageId, state, version) {
        if (!available) {
          firstFailure.resolve();
          return Promise.resolve({ status: 503 });
        }
        storedState = state;
        storedVersion = version;
        return Promise.resolve({ status: 200 });
      },
    };
    const hooks = createCollabPersistenceHooks({
      persistence: api,
      sharedSecret: 'secret',
      logger: {},
      writerOptions: { sleep: () => retry.promise },
      loadWaitTimeoutMs: 20,
    });
    const server = new Hocuspocus({
      quiet: true,
      stopOnSignals: false,
      onLoadDocument: hooks.onLoadDocument,
      onStoreDocument: hooks.onStoreDocument,
      afterUnloadDocument: () => { unloaded.resolve(); return Promise.resolve(); },
    });

    const a = await server.openDirectConnection(pageId);
    await a.transact((document) => { document.getMap('content').set('a', true); });
    await firstFailure.promise;
    await a.disconnect();
    await unloaded.promise;

    const expectedError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(server.openDirectConnection(pageId)).rejects.toThrow('pending store timed out');
    } finally {
      expectedError.mockRestore();
    }
    expect(loadCalls).toBe(1); // после таймаута не читаем старую версию

    available = true;
    retry.resolve();
    await hooks.flushWriters();
    const b = await server.openDirectConnection(pageId);
    expect(b.document?.getMap('content').get('a')).toBe(true);
    await b.disconnect();
    await hooks.flushWriters();
  });
});
