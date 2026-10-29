import { describe, expect, it, vi } from 'vitest';
import { RevisionSnapshotQueue } from '../src/platform/revision-snapshot-queue.js';
type State = { revision: number; game: { value: number } };
const state = (revision: number, value = revision): State => ({ revision, game: { value } });
function deferred() { let resolve!: () => void; let reject!: (e: unknown) => void; const promise = new Promise<void>((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
const make = (write = vi.fn(async (_raw: string) => {}), initial?: State) => new RevisionSnapshotQueue<State>({ revision: s => s.revision, encode: JSON.stringify, write, ...(initial ? { initial } : {}) });

describe('revision snapshot queue', () => {
  it('coalesces synchronous pending snapshots and resolves all callers after persistence', async () => {
    const disk = deferred(); const write = vi.fn((_raw: string) => disk.promise); const q = make(write);
    let completed = 0; const a = q.enqueue(state(1)).then(() => completed++); const b = q.enqueue(state(2)).then(() => completed++);
    await Promise.resolve(); expect(write).toHaveBeenCalledTimes(1); expect(JSON.parse(write.mock.calls[0]![0]!)).toEqual(state(2)); expect(completed).toBe(0);
    disk.resolve(); await Promise.all([a,b]); expect(completed).toBe(2); expect(q.getCommittedRevision()).toBe(2);
  });
  it('never replaces the in-flight write; collapses only pending full snapshots', async () => {
    const disk = deferred(); const writes: number[] = [];
    const q = make(vi.fn(async raw => { const r = JSON.parse(raw).revision; writes.push(r); if (r===1) await disk.promise; }));
    const a=q.enqueue(state(1)); await Promise.resolve(); const b=q.enqueue(state(2)); const c=q.enqueue(state(3));
    expect(writes).toEqual([1]); disk.resolve(); await Promise.all([a,b,c]); expect(writes).toEqual([1,3]);
  });
  it('captures nested state before a caller mutates it', async () => {
    const write=vi.fn(async (_raw: string)=>{}); const q=make(write); const s=state(1); const done=q.enqueue(s); s.game.value=99; await done;
    expect(JSON.parse(write.mock.calls[0]![0]!)).toEqual(state(1));
  });
  it('rejects conflicting or older snapshots without touching the queue', async () => {
    const q=make(); const a=q.enqueue(state(2)); await expect(q.enqueue(state(1))).rejects.toThrow('Stale');
    await expect(q.enqueue(state(2,99))).rejects.toThrow('Conflicting'); await a; expect(q.getCommittedRevision()).toBe(2);
  });
  it('same revision and encoding is idempotent pending, active and committed', async () => {
    const disk=deferred(); const write=vi.fn((_raw: string)=>disk.promise); const q=make(write);
    const a=q.enqueue(state(1)); await Promise.resolve(); const b=q.enqueue(state(1)); disk.resolve(); await Promise.all([a,b]);
    await q.enqueue(state(1)); expect(write).toHaveBeenCalledTimes(1);
  });
  it('propagates a coalesced failure to every caller and flush, then retries the same snapshot', async () => {
    const write=vi.fn(async (_raw:string)=>{}).mockRejectedValueOnce(Error('disk')); const q=make(write);
    const a=q.enqueue(state(1)); const b=q.enqueue(state(2)); const f=q.flush();
    const outcomes=await Promise.allSettled([a,b,f]); expect(outcomes.map(o=>o.status)).toEqual(['rejected','rejected','rejected']);
    expect(q.getCommittedRevision()).toBe(-1); await q.enqueue(state(2)); expect(q.getCommittedRevision()).toBe(2);
    await expect(q.enqueue(state(1))).rejects.toThrow('Stale');
  });
  it('continues with a newer queued snapshot after an active write fails', async () => {
    const disk=deferred(); const write=vi.fn(async (_raw:string)=>{}).mockImplementationOnce(()=>disk.promise); const q=make(write);
    const a=q.enqueue(state(1)); const failure=expect(a).rejects.toThrow('disk'); await Promise.resolve(); const b=q.enqueue(state(2)); disk.reject(Error('disk'));
    await failure; await b; expect(q.getCommittedRevision()).toBe(2);
  });
  it('flush tracks the tail accepted at call time', async () => {
    const one=deferred(),two=deferred(); const write=vi.fn(async (_raw:string)=>{}).mockImplementationOnce(()=>one.promise).mockImplementationOnce(()=>two.promise); const q=make(write);
    const a=q.enqueue(state(1)); await Promise.resolve(); const oldFlush=q.flush(); const b=q.enqueue(state(2)); one.resolve(); await oldFlush;
    expect(q.getCommittedRevision()).toBe(1); two.resolve(); await Promise.all([a,b,q.flush()]);
  });
  it('loads a durable baseline without rewriting it', async () => {
    const write=vi.fn(async (_raw:string)=>{}); const q=make(write,state(4)); await q.enqueue(state(4)); expect(write).not.toHaveBeenCalled();
    await expect(q.enqueue(state(3))).rejects.toThrow('Stale'); await q.enqueue(state(5)); expect(q.getCommittedRevision()).toBe(5);
  });
  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER+1])('rejects invalid revision %s', async revision => {
    await expect(make().enqueue(state(revision))).rejects.toThrow('Invalid');
  });
  it('an encoder failure does not poison subsequent writes', async () => {
    const q=new RevisionSnapshotQueue<State>({ revision:s=>s.revision, encode:s=>{if(s.game.value===9)throw Error('encode');return JSON.stringify(s);}, write:async()=>{} });
    await expect(q.enqueue(state(1,9))).rejects.toThrow('encode'); await q.enqueue(state(1));
  });
  it('recovers an ambiguous full-snapshot write by safely retrying identical bytes', async () => {
    let raw=''; let fail=true; const q=make(vi.fn(async next=>{raw=next;if(fail){fail=false;throw Error('ack lost');}}));
    await expect(q.enqueue(state(1))).rejects.toThrow(); expect(JSON.parse(raw)).toEqual(state(1)); await q.enqueue(state(1)); expect(q.getCommittedRevision()).toBe(1);
  });
});
