import { describe, expect, it, vi } from 'vitest';

import {
  DurablePendingTransactionInvariantError,
  DurablePendingTransactionRecoveryRequiredError,
  DurablePendingTransactionSession,
  type DurablePendingTransactionAdapter,
} from '../src/core/durable-pending-transaction';

interface PendingReward {
  id: string;
  amount: number;
}

interface TestState {
  balance: number;
  pending: PendingReward | null;
  committedIds: string[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

class MemoryStore {
  public state: TestState = { balance: 10, pending: null, committedIds: [] };
  public writes = 0;
  public throwAfterWriteOn = new Set<number>();
  public failNextLoad = false;

  public async load(): Promise<TestState> {
    if (this.failNextLoad) {
      this.failNextLoad = false;
      throw new Error('reload failed');
    }
    return clone(this.state);
  }

  public async write(next: TestState): Promise<TestState> {
    this.writes += 1;
    this.state = clone(next);
    if (this.throwAfterWriteOn.has(this.writes)) {
      throw new Error(`ambiguous write ${this.writes}`);
    }
    return clone(this.state);
  }
}

const createAdapter = (
  store: MemoryStore,
  createPending: () => PendingReward = () => ({ id: 'tx-1', amount: 7 }),
): DurablePendingTransactionAdapter<TestState, PendingReward> => ({
  load: () => store.load(),
  getPending: (state) => state.pending,
  createPending: vi.fn(createPending),
  stage: (state, pending) => store.write({ ...state, pending: clone(pending) }),
  commit: (state, pending) =>
    store.write({
      balance: state.balance + pending.amount,
      pending: null,
      committedIds: [...state.committedIds, pending.id],
    }),
  isSamePending: (left, right) => left.id === right.id,
  isCommitted: (state, pending) => state.pending === null && state.committedIds.includes(pending.id),
});

describe('DurablePendingTransactionSession', () => {
  it('persists the exact pending transaction before prepare returns and leaves durable effects unapplied', async () => {
    const store = new MemoryStore();
    const session = new DurablePendingTransactionSession(createAdapter(store));
    await session.load();

    const pending = await session.prepare();

    expect(pending).toEqual({ id: 'tx-1', amount: 7 });
    expect(store.state.pending).toEqual(pending);
    expect(store.state.balance).toBe(10);
    expect(session.getPending()).toEqual(pending);
  });

  it('reuses a recovered pending transaction without resolving another one', async () => {
    const store = new MemoryStore();
    store.state.pending = { id: 'stable', amount: 9 };
    const createPending = vi.fn(() => ({ id: 'new', amount: 100 }));
    const session = new DurablePendingTransactionSession(createAdapter(store, createPending));
    await session.load();

    await expect(session.prepare()).resolves.toEqual({ id: 'stable', amount: 9 });
    expect(createPending).not.toHaveBeenCalled();
    expect(store.writes).toBe(0);
  });

  it('accepts an ambiguous stage failure only when reload proves the exact transaction became durable', async () => {
    const store = new MemoryStore();
    store.throwAfterWriteOn.add(1);
    const session = new DurablePendingTransactionSession(createAdapter(store));
    await session.load();

    await expect(session.prepare()).resolves.toEqual({ id: 'tx-1', amount: 7 });
    expect(session.requiresRecovery()).toBe(false);
    expect(store.state.pending?.id).toBe('tx-1');
  });

  it('blocks reroll/retry after an ambiguous stage when recovery reload also fails', async () => {
    const store = new MemoryStore();
    store.throwAfterWriteOn.add(1);
    const session = new DurablePendingTransactionSession(createAdapter(store));
    await session.load();
    store.failNextLoad = true;

    await expect(session.prepare()).rejects.toThrow('ambiguous write 1');
    expect(session.requiresRecovery()).toBe(true);
    await expect(session.prepare()).rejects.toBeInstanceOf(DurablePendingTransactionRecoveryRequiredError);

    await session.load();
    expect(session.requiresRecovery()).toBe(false);
    await expect(session.prepare()).resolves.toEqual({ id: 'tx-1', amount: 7 });
    expect(store.writes).toBe(1);
  });

  it('commits exactly once and repeated commit calls become no-ops after pending state is cleared', async () => {
    const store = new MemoryStore();
    const session = new DurablePendingTransactionSession(createAdapter(store));
    await session.load();
    await session.prepare();

    const committed = await session.commit();
    const committedAgain = await session.commit();

    expect(committed.balance).toBe(17);
    expect(committed.committedIds).toEqual(['tx-1']);
    expect(committed.pending).toBeNull();
    expect(committedAgain).toEqual(committed);
    expect(store.writes).toBe(2);
  });

  it('recovers an ambiguous commit when reload proves that exact transaction already committed', async () => {
    const store = new MemoryStore();
    const session = new DurablePendingTransactionSession(createAdapter(store));
    await session.load();
    await session.prepare();
    store.throwAfterWriteOn.add(2);

    const committed = await session.commit();

    expect(committed.balance).toBe(17);
    expect(committed.committedIds).toEqual(['tx-1']);
    expect(session.requiresRecovery()).toBe(false);
  });

  it('prevents a second commit attempt when an ambiguous commit cannot be reloaded yet', async () => {
    const store = new MemoryStore();
    const session = new DurablePendingTransactionSession(createAdapter(store));
    await session.load();
    await session.prepare();
    store.throwAfterWriteOn.add(2);
    store.failNextLoad = true;

    await expect(session.commit()).rejects.toThrow('ambiguous write 2');
    expect(session.requiresRecovery()).toBe(true);
    await expect(session.commit()).rejects.toBeInstanceOf(DurablePendingTransactionRecoveryRequiredError);

    const reloaded = await session.load();
    expect(reloaded.balance).toBe(17);
    expect(reloaded.pending).toBeNull();
    await expect(session.commit()).resolves.toEqual(reloaded);
    expect(store.writes).toBe(2);
  });

  it('rejects adapter stage results that do not prove the requested pending transaction exists', async () => {
    const store = new MemoryStore();
    const adapter = createAdapter(store);
    adapter.stage = async (state) => clone(state);
    const session = new DurablePendingTransactionSession(adapter);
    await session.load();

    await expect(session.prepare()).rejects.toBeInstanceOf(DurablePendingTransactionInvariantError);
    expect(store.state.pending).toBeNull();
  });
});
