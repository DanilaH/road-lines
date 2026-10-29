import type { StorageAdapter } from './storage.js';

export interface JsonStateCodec<State> {
  decode(value: unknown): State;
  encode?: (state: State) => unknown;
}

export interface JsonStorageRepositoryOptions<State> {
  storage: StorageAdapter;
  key: string;
  createDefault: () => State;
  codec: JsonStateCodec<State>;
}

/**
 * Small versioned-JSON persistence seam.
 *
 * The repository owns JSON parsing/serialization and serializes writes from one
 * repository instance. Validation, schema migration and domain invariants stay in
 * the injected codec so game policy does not leak into the storage layer.
 */
export class JsonStorageRepository<State> {
  private writeQueue: Promise<void> = Promise.resolve();

  public constructor(private readonly options: JsonStorageRepositoryOptions<State>) {}

  public async load(): Promise<State> {
    const raw = await this.options.storage.getItem(this.options.key);
    if (raw === null) return this.options.createDefault();
    const parsed: unknown = JSON.parse(raw);
    return this.options.codec.decode(parsed);
  }

  public async loadOrDefault(onError?: (error: unknown) => void): Promise<State> {
    try {
      return await this.load();
    } catch (error: unknown) {
      onError?.(error);
      return this.options.createDefault();
    }
  }

  public write(state: State): Promise<void> {
    const encoded = this.options.codec.encode?.(state) ?? state;
    const raw = JSON.stringify(encoded);
    if (raw === undefined) {
      return Promise.reject(new TypeError('JSON repository root value is not serializable'));
    }

    const task = this.writeQueue
      .catch(() => undefined)
      .then(() => this.options.storage.setItem(this.options.key, raw));
    this.writeQueue = task;
    return task;
  }

  public remove(): Promise<void> {
    const task = this.writeQueue
      .catch(() => undefined)
      .then(() => this.options.storage.removeItem(this.options.key));
    this.writeQueue = task;
    return task;
  }

  public flush(): Promise<void> {
    return this.writeQueue;
  }
}
