import { describe, expect, it, vi } from 'vitest';
import { DurableReceiptQueue, type ReceiptCommitResult } from '../src/platform/durable-receipt-queue';

interface Receipt { id: string; amount: number; }

// Models the consumer's durable state, distinct from queue instance memory.
const fixture = () => {
  const state = { balance: 0, processed: new Set<string>(), pending: new Set(['one']) };
  const commit = vi.fn(async (receipt: Receipt): Promise<ReceiptCommitResult> => {
    if (state.processed.has(receipt.id)) return 'already-applied';
    state.balance += receipt.amount;
    state.processed.add(receipt.id);
    return 'applied';
  });
  const acknowledge = vi.fn(async (id: string) => { state.pending.delete(id); });
  return { state, commit, acknowledge };
};

describe('DurableReceiptQueue', () => {
  it('does not acknowledge before persistence resolves', async () => {
    let release!: (result: ReceiptCommitResult) => void;
    const acknowledge = vi.fn(async () => {});
    const queue = new DurableReceiptQueue<Receipt>({
      commit: () => new Promise((resolve) => { release = resolve; }), acknowledge,
    });
    const delivery = queue.deliver({ id: 'one', amount: 3 });
    await Promise.resolve();
    expect(acknowledge).not.toHaveBeenCalled();
    release('applied');
    await expect(delivery).resolves.toBe('applied');
    expect(acknowledge).toHaveBeenCalledWith('one');
  });

  it('serializes concurrent callback/result/startup duplicates through durable deduplication', async () => {
    const f = fixture();
    const queue = new DurableReceiptQueue<Receipt>(f);
    await expect(Promise.all([1, 2, 3].map(() => queue.deliver({ id: 'one', amount: 3 }))))
      .resolves.toEqual(['applied', 'already-applied', 'already-applied']);
    expect(f.state.balance).toBe(3);
    expect(f.state.pending.size).toBe(0);
  });

  it('holds later work until both commit and acknowledgement of the first delivery finish', async () => {
    let release!: () => void;
    const order: string[] = [];
    const queue = new DurableReceiptQueue<Receipt>({
      async commit(receipt) { order.push(`commit:${receipt.id}`); return 'applied'; },
      async acknowledge(id) {
        order.push(`ack:${id}`);
        if (id === 'one') await new Promise<void>((resolve) => { release = resolve; });
      },
    });
    const first = queue.deliver({ id: 'one', amount: 3 });
    const second = queue.deliver({ id: 'two', amount: 4 });
    await vi.waitFor(() => expect(order).toEqual(['commit:one', 'ack:one']));
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['commit:one', 'ack:one', 'commit:two', 'ack:two']);
  });

  it('leaves a failed save pending and permits a later successful delivery', async () => {
    const f = fixture();
    f.commit.mockRejectedValueOnce(new Error('disk full'));
    const queue = new DurableReceiptQueue<Receipt>(f);
    await expect(queue.deliver({ id: 'one', amount: 3 })).rejects.toThrow('disk full');
    expect(f.acknowledge).not.toHaveBeenCalled();
    expect(f.state.pending.has('one')).toBe(true);
    await queue.deliver({ id: 'one', amount: 3 });
    expect(f.state.balance).toBe(3);
  });

  it('recovers after commit persisted but its promise rejected', async () => {
    const f = fixture();
    const commit = f.commit.getMockImplementation()!;
    f.commit.mockImplementationOnce(async (receipt) => {
      await commit(receipt);
      throw new Error('ambiguous save');
    });
    const queue = new DurableReceiptQueue<Receipt>(f);
    await expect(queue.deliver({ id: 'one', amount: 3 })).rejects.toThrow('ambiguous save');
    expect(f.acknowledge).not.toHaveBeenCalled();
    // A restarted queue must consult the same durable ledger, not an in-memory set.
    await expect(new DurableReceiptQueue<Receipt>(f).deliver({ id: 'one', amount: 3 }))
      .resolves.toBe('already-applied');
    expect(f.state.balance).toBe(3);
  });

  it('retries acknowledgement after restart without granting again', async () => {
    const f = fixture();
    f.acknowledge.mockRejectedValueOnce(new Error('ack failed'));
    await expect(new DurableReceiptQueue<Receipt>(f).deliver({ id: 'one', amount: 3 }))
      .rejects.toThrow('ack failed');
    expect(f.state.pending.has('one')).toBe(true);
    await expect(new DurableReceiptQueue<Receipt>(f).deliver({ id: 'one', amount: 3 }))
      .resolves.toBe('already-applied');
    expect(f.state.balance).toBe(3);
    expect(f.state.pending.size).toBe(0);
  });

  it('snapshots queued data and preserves FIFO across different receipts', async () => {
    const f = fixture();
    const queue = new DurableReceiptQueue<Receipt>(f);
    const receipt = { id: 'one', amount: 3 };
    const first = queue.deliver(receipt);
    receipt.id = 'changed'; receipt.amount = 100;
    const second = queue.deliver({ id: 'two', amount: 4 });
    await Promise.all([first, second]);
    expect(f.state.balance).toBe(7);
    expect(f.acknowledge.mock.calls).toEqual([['one'], ['two']]);
  });

  it('rejects invalid ids without touching storage or poisoning the queue', async () => {
    const f = fixture(); const queue = new DurableReceiptQueue<Receipt>(f);
    await expect(queue.deliver({ id: ' ', amount: 3 })).rejects.toThrow('non-empty id');
    expect(f.commit).not.toHaveBeenCalled();
    await queue.deliver({ id: 'one', amount: 3 });
    expect(f.state.balance).toBe(3);
  });

  it('does not acknowledge when an untyped bridge adapter fails to confirm durability', async () => {
    const f = fixture();
    f.commit.mockResolvedValueOnce(undefined as unknown as ReceiptCommitResult);
    await expect(new DurableReceiptQueue<Receipt>(f).deliver({ id: 'one', amount: 3 }))
      .rejects.toThrow('did not confirm');
    expect(f.acknowledge).not.toHaveBeenCalled();
  });
});
