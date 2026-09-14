export interface DocWriterDeps {
  /** PUT снапшота: HTTP-статус (200 ок, 409 устаревшая версия, 5xx транзиент, 4xx фатал). */
  store(state: string, version: number): Promise<{ status: number }>;
  /** Сохранённая версия из API (seed и ресинк), null при ошибке загрузки. */
  loadVersion(): Promise<number | null>;
  sleep?: (ms: number) => Promise<void>;
  backoff?: (attempt: number) => number;
  logger?: { warn?: (...a: unknown[]) => void; error?: (...a: unknown[]) => void };
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const defaultBackoff = (attempt: number): number => Math.min(200 * 2 ** (attempt - 1), 3000);

/**
 * Персист снапшота одного документа (#109). Захват состояния — синхронный
 * (`save`), запись — в фоне одним воркером на документ:
 * - сериализация: одновременно не более одной записи; новое состояние коалесится
 *   (снапшоты кумулятивны внутри одной загрузки Y.Doc; повторная загрузка ждёт flush);
 * - надёжность: 5xx/сеть → backoff и повтор БЕЗ новых правок (в т.ч. после
 *   выгрузки документа — состояние держим в памяти, не в Y.Doc); сохранённым
 *   считаем только 200 — исчерпания-в-успех нет;
 * - 409 → перечитываем версию из API (ресинк после потерянного ответа) и повтор;
 * - 4xx (400/403/404/413) — фатал, дропаем с логом;
 * - наружу не бросаем (нет unhandledRejection из debounce-таймера Hocuspocus).
 */
export class DocWriter {
  private version: number | null = null;
  private pending: string | undefined;
  private running = false;
  private idle: Promise<void> = Promise.resolve();
  private resolveIdle: (() => void) | undefined;

  constructor(private readonly deps: DocWriterDeps) {}

  /** Seed версии из onLoadDocument. */
  setVersion(version: number): void {
    this.version = version;
  }

  /** Захватить последнее состояние к сохранению и запустить фоновый воркер. */
  save(state: string): void {
    this.pending = state;
    if (!this.running) {
      this.running = true;
      this.idle = new Promise((resolve) => {
        this.resolveIdle = resolve;
      });
      void this.worker();
    }
  }

  /** Дождаться, пока всё захваченное сохранится (для graceful shutdown). */
  flush(): Promise<void> {
    return this.running ? this.idle : Promise.resolve();
  }

  private async worker(): Promise<void> {
    while (this.pending !== undefined) {
      const target = this.pending;
      this.pending = undefined;
      await this.persist(target);
    }
    this.running = false;
    this.resolveIdle?.();
  }

  private async persist(target: string): Promise<void> {
    const sleep = this.deps.sleep ?? defaultSleep;
    const backoff = this.deps.backoff ?? defaultBackoff;
    let attempt = 0;

    for (;;) {
      // Появилось более свежее состояние — бросаем текущее (новое кумулятивно
      // содержит старое), воркер сохранит его следующей итерацией.
      if (this.pending !== undefined) {
        return;
      }
      if (this.version === null) {
        this.version = (await this.deps.loadVersion()) ?? 0;
      }
      const next = this.version + 1;

      let status: number;
      try {
        ({ status } = await this.deps.store(target, next));
      } catch {
        attempt += 1;
        await sleep(backoff(attempt)); // сеть — транзиент, повтор
        continue;
      }

      if (status === 200) {
        this.version = next;
        return;
      }
      if (status === 409) {
        const server = await this.deps.loadVersion();
        if (server !== null) {
          this.version = server;
        }
        continue; // ресинк и повтор
      }
      if (status >= 500) {
        attempt += 1;
        await sleep(backoff(attempt)); // 5xx — транзиент, повтор
        continue;
      }

      // 4xx — фатал (невалидные данные/нет доступа/страница удалена): не повторяем.
      this.deps.logger?.error?.('collab store rejected (fatal)', status);
      return;
    }
  }
}
