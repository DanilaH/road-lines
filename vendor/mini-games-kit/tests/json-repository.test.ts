import { describe, expect, it, vi } from 'vitest';

import { JsonStorageRepository } from '../src/platform/json-repository';
import type { StorageAdapter } from '../src/platform/storage';

class MemoryStorage implements StorageAdapter {
  public readonly values = new Map<string, string>();
  public writes = 0;
  public failWriteNumber: number | null = null;

  public async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.writes += 1;
    if (this.failWriteNumber === this.writes) throw new Error(`write ${this.writes} failed`);
    this.values.set(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

interface State {
  version: 2;
  score: number;
}

const createRepository = (storage: StorageAdapter): JsonStorageRepository<State> =>
  new JsonStorageRepository({
    storage,
    key: 'save',
    createDefault: () => ({ version: 2, score: 0 }),
    codec: {
      decode: (value) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid save');
        const record = value as Record<string, unknown>;
        if (record.version === 1 && typeof record.score === 'number') {
          return { version: 2, score: record.score };
        }
        if (record.version !== 2 || typeof record.score !== 'number') throw new Error('invalid save');
        return { version: 2, score: record.score };
      },
    },
  });

describe('JsonStorageRepository', () => {
  it('returns defaults for a missing value and lets the codec migrate parsed JSON', async () => {
    const storage = new MemoryStorage();
    const repository = createRepository(storage);

    await expect(repository.load()).resolves.toEqual({ version: 2, score: 0 });
    storage.values.set('save', JSON.stringify({ version: 1, score: 12 }));
    await expect(repository.load()).resolves.toEqual({ version: 2, score: 12 });
  });

  it('keeps strict load failures visible while loadOrDefault provides an explicit fallback path', async () => {
    const storage = new MemoryStorage();
    storage.values.set('save', '{not-json');
    const repository = createRepository(storage);
    const onError = vi.fn();

    await expect(repository.load()).rejects.toThrow();
    await expect(repository.loadOrDefault(onError)).resolves.toEqual({ version: 2, score: 0 });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('serializes writes and continues the queue after a failed write', async () => {
    const storage = new MemoryStorage();
    storage.failWriteNumber = 1;
    const repository = createRepository(storage);

    const first = repository.write({ version: 2, score: 1 });
    const second = repository.write({ version: 2, score: 2 });

    await expect(first).rejects.toThrow('write 1 failed');
    await expect(second).resolves.toBeUndefined();
    await expect(repository.flush()).resolves.toBeUndefined();
    expect(JSON.parse(storage.values.get('save') ?? '{}')).toEqual({ version: 2, score: 2 });
  });

  it('serializes remove behind earlier writes', async () => {
    const storage = new MemoryStorage();
    const repository = createRepository(storage);

    const write = repository.write({ version: 2, score: 9 });
    const remove = repository.remove();
    await Promise.all([write, remove]);

    expect(storage.values.has('save')).toBe(false);
  });
});
