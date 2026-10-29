export interface RevisionSnapshotQueueOptions<State> {
  revision(state: State): number;
  /** Must synchronously encode a complete, independent snapshot. */
  encode(state: State): string;
  /** Resolve only after the snapshot is durable. One writer per storage key. */
  write(raw: string): Promise<void>;
  /** Optional already-durable state loaded and validated by the consumer. */
  initial?: State;
}

type Snapshot = { revision: number; raw: string };
type Waiter = { resolve(): void; reject(error: unknown): void };
type Batch = { snapshot: Snapshot; waiters: Waiter[] };

/** Coalesces pending complete snapshots; never coalesces commands or transactions. */
export class RevisionSnapshotQueue<State> {
  private accepted: Snapshot | null = null;
  private committed = -1;
  private pending: Batch | null = null;
  private draining = false;
  private tail: Promise<void> = Promise.resolve();

  public constructor(private readonly options: RevisionSnapshotQueueOptions<State>) {
    if (options.initial !== undefined) {
      this.accepted = this.capture(options.initial);
      this.committed = this.accepted.revision;
    }
  }

  public enqueue(state: State): Promise<void> {
    let snapshot: Snapshot;
    try {
      snapshot = this.capture(state);
      if (this.accepted) {
        if (snapshot.revision < this.accepted.revision) throw new Error('Stale snapshot revision');
        if (snapshot.revision === this.accepted.revision && snapshot.raw !== this.accepted.raw) {
          throw new Error('Conflicting snapshots share a revision');
        }
      }
    } catch (error: unknown) {
      return Promise.reject(error);
    }
    if (snapshot.revision === this.committed) return Promise.resolve();
    this.accepted = snapshot;
    const promise = new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };
      if (this.pending) {
        this.pending.snapshot = snapshot;
        this.pending.waiters.push(waiter);
      } else this.pending = { snapshot, waiters: [waiter] };
    });
    this.tail = promise;
    // The caller still receives rejection; the internal flush tail is observed too.
    void promise.catch(() => undefined);
    if (!this.draining) {
      this.draining = true;
      queueMicrotask(() => { void this.drain(); });
    }
    return promise;
  }

  /** Wait for work accepted before this call. Later enqueues need a later flush. */
  public flush(): Promise<void> { return this.tail; }
  public getCommittedRevision(): number { return this.committed; }

  private capture(state: State): Snapshot {
    const revision = this.options.revision(state);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid snapshot revision');
    const raw = this.options.encode(state);
    if (typeof raw !== 'string') throw new Error('Snapshot encoder must return a string');
    return { revision, raw };
  }

  private async drain(): Promise<void> {
    while (this.pending) {
      const batch = this.pending;
      this.pending = null;
      try {
        if (batch.snapshot.revision > this.committed) {
          await this.options.write(batch.snapshot.raw);
          this.committed = batch.snapshot.revision;
        }
        for (const waiter of batch.waiters) waiter.resolve();
      } catch (error: unknown) {
        for (const waiter of batch.waiters) waiter.reject(error);
      }
    }
    this.draining = false;
  }
}
