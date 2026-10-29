# Durable external receipt delivery

Import `DurableReceiptQueue`, `DurableReceiptAdapter`, `DurableReceipt` and `ReceiptCommitResult` from `@danilah/mini-games-kit/platform`.

## Problem and API

A native rewarded-ad bridge can report the same earned reward through an event, a show result and a recovered pending receipt. It must retain the receipt until the game has durably saved the reward. `DurableReceiptQueue<Receipt extends { id: string }>` serializes these deliveries and acknowledges only a confirmed commit.

```ts
type Receipt = { id: string; contextId: string };

const inbox = new DurableReceiptQueue<Receipt>({
  async commit(receipt) {
    // This operation must serialize with ALL other writes to the game save.
    return gameSave.update(async (state) => {
      if (state.processedReceipts.includes(receipt.id)) return 'already-applied';
      grantEarnedHelp(state, receipt.contextId); // consumer policy
      state.processedReceipts.push(receipt.id);
      await persistDurably(state); // effect + id in the SAME durable document/transaction
      return 'applied';
    });
  },
  acknowledge: (id) => nativeBridge.acknowledge({ token: id }),
});

// Normalize the native bridge shape at the integration boundary.
const receive = (r: { token: string; attempt: string }) =>
  inbox.deliver({ id: r.token, contextId: r.attempt });

// Route event, show result AND startup pending recovery through receive().
// Handle failures: show save trouble and retain the native pending receipt.
await receive(pendingReceipt);
```

`gameSave.update`, `grantEarnedHelp`, `persistDurably` and `nativeBridge` above are consumer-owned adapter pseudocode, not kit APIs. A real store implementation must return `'already-applied'` only after consulting authoritative durable state, including recovery after ambiguous writes. Merely finding a receipt in a mutated in-memory object is insufficient.

`deliver(receipt): Promise<'applied' | 'already-applied'>` clones a structured-cloneable receipt immediately, rejects empty ids, queues it FIFO, calls `commit`, then `acknowledge` for its captured id. A commit or acknowledgement error rejects that delivery; later deliveries still run. There is no hidden retry loop and no permanent in-memory deduplication cache. Catch/report every delivery promise at its call site.

## Required adapter guarantees

1. The external source durably stores the earned receipt **before** notifying JS, and deletes only the matching id after acknowledgement. An ad close/dismiss event is not proof of earning a reward.
2. `commit` atomically persists the reward and processed id before resolving `'applied'`. It is idempotent across duplicate delivery, process restarts and ambiguous-write recovery. It must reject when durable truth cannot be established.
3. All consumers of the save participate in the same write ordering/concurrency scheme. One queue serializes only its own deliveries; it cannot protect against another tab, repository instance or ordinary save write.
4. A failed acknowledgement retains the external receipt. On recovery, `commit` returns `'already-applied'`, then acknowledgement is retried. Do not let a failed save or acknowledgement silently erase earned rewards.
5. Keep deduplication ids for the possible replay horizon. Trimming an arbitrary number of ids is unsafe unless the external source can no longer replay those ids. The kit chooses no ledger cap.
6. If the rewarded game attempt disappeared after restoring an older backup, explicitly choose a consumer recovery policy. Do not silently acknowledge an ungranted reward. Seeds assigns the earned help to the current attempt; that is not a universal default.
7. When profiles exist, include the owning profile and destination in the receipt and validate them during commit. A profile switch must not redirect an earned receipt to another user. Seeds has no account model; its current-attempt fallback is not a cross-profile recovery policy.

The queue does not validate SDK authenticity, grant amounts, choose a reward target, implement storage, automatically reload ambiguous writes, prove server-side exactly-once processing or provide a durable transaction by itself. A resolved adapter promise is a trust boundary. Avoid reentrant calls to `deliver` from an adapter callback that waits for that same queue.

Use the existing [`DurablePendingTransactionSession`](../core/DURABLE_PENDING_TRANSACTION.md) for transactions the game itself creates/stages. This queue covers an **externally persisted receipt and its acknowledgement**, which is a different boundary.

## Combining with revision snapshot saves

[`RevisionSnapshotQueue`](REVISION_SNAPSHOT_QUEUE.md) coalesces complete ordinary snapshots. `DurableReceiptQueue` serializes receipt deliveries. Neither queue is a lock shared with the other. `await snapshots.flush()` by itself is insufficient: a producer can enqueue again during the receipt write, or enqueue an old snapshot with a revision that the old queue has never seen. It can overwrite both the reward and its deduplication marker.

A consumer can use this explicit handoff without adding another kit coordinator:

1. Enter the consumer's exclusive save/profile operation and **quiesce ordinary snapshot producers**, including pending autosave timers and asynchronous callbacks. Reject or retain incoming actions for later rebasing; do not silently discard gameplay.
2. Settle all accepted ordinary writes and handle individual failures. Flush is a barrier only while producers are excluded. Keep the same profile identity throughout the operation.
3. Load/establish authoritative state, deduplicate and apply the receipt, increment the local revision, and durably replace the effect and ledger together. Return `'applied'` or `'already-applied'` only when authoritative durable truth proves it.
4. Construct a fresh snapshot queue using that durable state as `initial`, and update the state/revision from which ordinary producers derive their next snapshots. Retire the old queue. A failed acknowledgement does not undo the grant or allow restoring an old pre-reward baseline.
5. Acknowledge the exact native receipt after confirmed commit. Resume ordinary producers only after their baseline is safe. If a write outcome is ambiguous and authoritative reload fails, keep the save mutation gate closed until recovery establishes the truth; the receipt remains pending.

The consumer may implement a different coordinated writer, but must prove the same ordering and stale-state exclusion. A Promise chain around disk I/O alone does not make an already-created stale snapshot current. This is a consumer integration recipe, not an atomic transaction guarantee provided by either queue. See `tests/receipt-snapshot-integration.test.ts` for executable happy-path and acknowledgement-recovery examples with both real kit APIs.

## Runtime and provenance

No Capacitor, ad SDK, Phaser or storage dependency. Requires Promises and `structuredClone` (Node 20+ and modern browsers/WebViews); receipts must be structured-cloneable data.

Extracted from `DanilaH/seeds-bits` revision `96caff6aac357e06b8373301b2b895544c9ef179`: `src/main.ts::receiveReward`, `src/hint-budget.ts::grantReward`, `native/android/SeedsMonetizationPlugin.java::{receipt,acknowledge,persistState}`. The source APK code is pinned at `86d950b970a69e5dec3ebc269075143a1c28f94a`.

Intentional changes: domain fields and +3-hint policy are removed; receipt payloads are snapshotted; save/ack errors propagate instead of being swallowed; deduplication and durable storage are explicit adapter responsibilities. This is a tested extraction, not evidence of a second shipped consumer or verified live SDK fill.
