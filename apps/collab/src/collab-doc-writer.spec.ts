import { DocWriter } from './collab-doc-writer';

const noSleep = (): Promise<void> => Promise.resolve();

describe('DocWriter', () => {
  it('после серии save финальное состояние сохранено, версии монотонны', async () => {
    const stored: Array<{ state: string; version: number }> = [];
    const writer = new DocWriter({
      loadVersion: () => Promise.resolve(0),
      store(state, version) {
        stored.push({ state, version });
        return Promise.resolve({ status: 200 });
      },
      sleep: noSleep,
    });

    writer.save('a');
    writer.save('b');
    writer.save('c');
    await writer.flush();

    expect(stored.length).toBeGreaterThan(0);
    expect(stored.at(-1)?.state).toBe('c'); // последнее состояние точно сохранено
    const versions = stored.map((s) => s.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b)); // строго по возрастанию
    expect(new Set(versions).size).toBe(versions.length); // без дублей версий
  });

  it('сериализует записи: не более одной в полёте', async () => {
    let inFlight = 0;
    let maxParallel = 0;
    const writer = new DocWriter({
      loadVersion: () => Promise.resolve(0),
      async store() {
        inFlight += 1;
        maxParallel = Math.max(maxParallel, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return { status: 200 };
      },
      sleep: noSleep,
    });

    writer.save('a');
    await Promise.resolve(); // дать воркеру начать первую запись
    writer.save('b');
    await writer.flush();

    expect(maxParallel).toBe(1);
  });

  it('на 409 перечитывает версию и повторяет (ресинк потерянного ответа)', async () => {
    const calls: number[] = [];
    let serverVersion = 5; // БД на 5, наш прошлый ответ потерялся
    const writer = new DocWriter({
      loadVersion: () => Promise.resolve(serverVersion),
      store(_state, version) {
        calls.push(version);
        if (version <= serverVersion) {
          return Promise.resolve({ status: 409 });
        }
        serverVersion = version;
        return Promise.resolve({ status: 200 });
      },
      sleep: noSleep,
    });
    writer.setVersion(0); // локальный счётчик отстал

    writer.save('x');
    await writer.flush();

    expect(calls).toEqual([1, 6]);
  });

  it('повторяет на 5xx до успеха (сохранённым считается только 200)', async () => {
    let attempts = 0;
    const writer = new DocWriter({
      loadVersion: () => Promise.resolve(0),
      store() {
        attempts += 1;
        return Promise.resolve({ status: attempts < 3 ? 503 : 200 });
      },
      sleep: noSleep,
    });

    writer.save('x');
    await writer.flush();

    expect(attempts).toBe(3); // 503, 503, 200
  });

  it('повторяет на сетевой ошибке без новых правок', async () => {
    let attempts = 0;
    const writer = new DocWriter({
      loadVersion: () => Promise.resolve(0),
      store() {
        attempts += 1;
        return attempts < 2 ? Promise.reject(new Error('down')) : Promise.resolve({ status: 200 });
      },
      sleep: noSleep,
    });

    writer.save('x');
    await writer.flush();

    expect(attempts).toBe(2);
  });

  it('4xx — фатал: дропаем без зацикливания', async () => {
    let attempts = 0;
    const writer = new DocWriter({
      loadVersion: () => Promise.resolve(0),
      store() {
        attempts += 1;
        return Promise.resolve({ status: 413 });
      },
      sleep: noSleep,
    });

    writer.save('x');
    await writer.flush();

    expect(attempts).toBe(1);
  });
});
