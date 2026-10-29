import { describe, expect, it, vi } from 'vitest';
import { DurableReceiptQueue } from '../src/platform/durable-receipt-queue.js';
import { RevisionSnapshotQueue } from '../src/platform/revision-snapshot-queue.js';

type Save = { revision: number; moves: number; hints: number; receipts: string[] };
type Receipt = { id: string };
const clone = (s: Save): Save => structuredClone(s);

// Consumer recipe, not an extra kit coordinator: one profile, ordinary producers
// quiesced for the durable handoff, fresh baseline and epoch after every commit.
function consumer() {
  let durable: Save = { revision: 0, moves: 0, hints: 0, receipts: [] };
  let current = clone(durable);
  let blocked = false;
  let epoch = 0;
  let ackFails = false;
  let writeFailsAfterPersist = false;
  let beforeWrite = async (_state: Save) => {};
  const pending = new Set(['reward']);
  const writes: Save[] = [];
  const persist = async (state: Save) => {
    await beforeWrite(state);
    durable = clone(state); writes.push(clone(state));
    if (writeFailsAfterPersist) {
      writeFailsAfterPersist = false;
      throw Error('ambiguous write');
    }
  };
  const makeSnapshots = () => new RevisionSnapshotQueue<Save>({
    initial: clone(durable), revision: s => s.revision, encode: JSON.stringify,
    write: raw => persist(JSON.parse(raw) as Save),
  });
  let snapshots = makeSnapshots();
  const rewards = new DurableReceiptQueue<Receipt>({
    async commit(receipt) {
      blocked = true;
      await snapshots.flush();
      // In a real adapter this is an authoritative storage load, not mutable UI state.
      const next = clone(durable);
      const already = next.receipts.includes(receipt.id);
      if (!already) {
        next.revision++; next.hints += 3; next.receipts.push(receipt.id);
        await persist(next);
      }
      current = clone(durable);
      snapshots = makeSnapshots();
      epoch++;
      blocked = false;
      return already ? 'already-applied' : 'applied';
    },
    async acknowledge(id) {
      if (ackFails) { ackFails = false; throw Error('ack failed'); }
      pending.delete(id);
    },
  });
  return {
    rewards, pending, writes,
    get durable() { return clone(durable); },
    get blocked() { return blocked; },
    get epoch() { return epoch; },
    capture() { return { epoch, state: clone(current) }; },
    async save(moves: number, captured = { epoch, state: clone(current) }) {
      if (blocked || captured.epoch !== epoch) throw Error('producer must rebase');
      current = { ...captured.state, revision: captured.state.revision + 1, moves };
      await snapshots.enqueue(current);
    },
    pauseWrites(fn: (state: Save) => Promise<void>) { beforeWrite = fn; },
    failAck() { ackFails = true; },
    failAfterPersist() { writeFailsAfterPersist = true; },
  };
}

describe('receipt and revision snapshot handoff', () => {
  it('drains a slow ordinary save, excludes stale producers, then rebases future saves on the reward', async () => {
    const c = consumer();
    let release!: () => void;
    c.pauseWrites(async s => {
      if (s.revision === 1) await new Promise<void>(resolve => { release = resolve; });
    });
    const ordinary = c.save(1);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const stale = c.capture();
    const delivery = c.rewards.deliver({ id: 'reward' });
    await vi.waitFor(() => expect(c.blocked).toBe(true));
    await expect(c.save(2)).rejects.toThrow('must rebase');
    expect(c.pending.has('reward')).toBe(true);
    release();
    await Promise.all([ordinary, delivery]);
    await expect(c.save(2, stale)).rejects.toThrow('must rebase');
    await c.save(2);
    expect(c.writes.map(s => s.revision)).toEqual([1, 2, 3]);
    expect(c.durable).toEqual({ revision: 3, moves: 2, hints: 3, receipts: ['reward'] });
    expect(c.pending.size).toBe(0);
  });

  it('retains the rewarded baseline when acknowledgement fails and ordinary saves continue before replay', async () => {
    const c = consumer(); c.failAck();
    await expect(c.rewards.deliver({ id: 'reward' })).rejects.toThrow('ack failed');
    expect(c.pending.has('reward')).toBe(true);
    await c.save(1);
    await expect(c.rewards.deliver({ id: 'reward' })).resolves.toBe('already-applied');
    await c.save(2);
    expect(c.durable).toEqual({ revision: 3, moves: 2, hints: 3, receipts: ['reward'] });
    expect(c.pending.size).toBe(0);
  });

  it('blocks ordinary writes after an ambiguous reward commit until authoritative retry rebases state', async () => {
    const c = consumer(); c.failAfterPersist();
    await expect(c.rewards.deliver({ id: 'reward' })).rejects.toThrow('ambiguous write');
    expect(c.pending.has('reward')).toBe(true);
    expect(c.blocked).toBe(true);
    await expect(c.save(1)).rejects.toThrow('must rebase');
    await expect(c.rewards.deliver({ id: 'reward' })).resolves.toBe('already-applied');
    await c.save(1);
    expect(c.durable.hints).toBe(3);
    expect(c.durable.moves).toBe(1);
    expect(c.pending.size).toBe(0);
  });
});
