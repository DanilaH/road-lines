# RevisionSnapshotQueue

Import from `@danilah/mini-games-kit/platform`. Framework-independent; no browser, React or native SDK required.

## Purpose and usage

Persist frequent **complete immutable state snapshots** without writing every intermediate version. It keeps the active write and coalesces waiting snapshots into the newest revision. Use this opt-in alternative only when newer state contains everything that must survive from older state. Existing JsonStorageRepository semantics are unchanged.

```ts
import { RevisionSnapshotQueue } from '@danilah/mini-games-kit/platform';

type Save = { revision: number; completedIds: string[] };
// Load/migrate/validate before constructing the queue.
const loaded: Save = { revision: 0, completedIds: [] };
const queue = new RevisionSnapshotQueue<Save>({
  initial: loaded, // omit when nothing is durable yet
  revision: state => state.revision,
  encode: state => JSON.stringify(state),
  write: raw => storage.setItem('game.save', raw),
});
await queue.enqueue({ revision: 1, completedIds: ['level-1'] });
await queue.flush();
console.log(queue.getCommittedRevision()); // 1
```

`initial` means already durable, not a default awaiting its first write. Without it the committed revision is -1. Revisions are non-negative safe integers, local to one writer/profile epoch. `encode` runs synchronously on enqueue and must return a stable string representation of the complete state. Later mutation of the caller's object cannot change queued bytes. Validation and codec migration are the consumer's responsibility.

## Ordering, conflicts and errors

- The active write is never cancelled. Pending snapshots are replaced before writing; their callers resolve after the replacement persists, or reject if that write fails.
- Enqueues below the greatest **accepted** revision reject as stale, including after a failed newer write. Same revision with different encoded bytes rejects. Identical latest snapshots can be retried; committed identical snapshots are no-ops. Deterministic serialization is required for this byte comparison.
- Failed writes reject their callers without poisoning later work. There is no automatic retry or backoff. Retrying identical complete bytes is safe only when the storage operation is an idempotent replacement. An API that increments counters is not such an operation.
- A failed active batch still rejects even if a newer pending batch subsequently succeeds. `flush()` returns the most recently accepted work's promise at call time; it does not aggregate every earlier error or wait for future work. Observe individual enqueue failures when they matter.
- Invalid input rejects without changing the accepted queue. Constructor validation errors throw synchronously. A write can have persisted before rejecting; committed revision is advanced only on acknowledged success. There is no authoritative reload/transaction reconciliation here.
- Queue lifetime is one writer per storage key/profile epoch. Before account switch, await outstanding writes and deal with any error, then construct a fresh queue with the destination's loaded state. Never redirect an existing writer closure to another account while work is pending.

## Non-goals

No loading, schema validation, cloud merging, cross-tab locking, multi-writer arbitration, profile ownership, event persistence or transactions. Do not use for payments, receipt acknowledgements, incremental commands or durable transaction staging: coalescing may erase intermediate facts. Use JsonStorageRepository when every write must occur, and the durable transaction/receipt protocols for rewarded operations.

## Source and intentional improvements

Extracted from Sudoku Doku 0.17 `src/platform/storage.ts` (`f97cc1ed1c32e7d2f438fbaea6671530b1a5fc59`). Unlike source saveLocal, bytes are captured immediately. Stale inputs and conflicting equal revisions reject rather than silently resolve. No Sudoku State, storage IDs, reducers or global schema imported.

Focused tests cover slow disk, pending coalescing, failure/retry, ambiguous acknowledgements, baseline/reload, object mutation, stale/equal revisions and flush boundaries. A local integration probe also roundtripped actual Sudoku newGame → input → openHint state through validateState, preserving undo, entries and cached explanations. This is adapter evidence, not deployment of the kit into the released APK.
