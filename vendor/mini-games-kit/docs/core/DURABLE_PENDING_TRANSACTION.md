# Durable pending transaction + ambiguous-write recovery

Import from `@danilah/mini-games-kit/core`.

## What it is

`DurablePendingTransactionSession<State, Pending>` is a small storage-agnostic transaction kernel for actions whose result must survive interrupted presentation, reloads and storage APIs that can fail **after** a write may already have become durable.

Typical uses include opening a reward, claiming a reward, crafting, spending currency for a deterministic result, finishing a run, or any other action where one user action must not reroll, duplicate or disappear because the app was interrupted at an awkward moment.

The lifecycle is deliberately small:

```text
base durable state
→ resolve one Pending value
→ persist that exact Pending value
→ presentation / other non-durable work
→ persist deterministic committed state
→ pending marker disappears
```

Presentation is never the owner of the transaction.

## Public API

```ts
interface DurablePendingTransactionAdapter<State, Pending> {
  load(): Promise<State>;
  getPending(state: State): Pending | null;
  createPending(state: State): Pending | Promise<Pending>;
  stage(state: State, pending: Pending): Promise<State>;
  commit(state: State, pending: Pending): Promise<State>;
  isSamePending(left: Pending, right: Pending): boolean;
  isCommitted(state: State, pending: Pending): boolean;
}

const session = new DurablePendingTransactionSession(adapter);
await session.load();

const pending = await session.prepare();
// Safe to present pending: it is already durable.

const committedState = await session.commit();
```

Other public helpers:

- `getState()` returns the last authoritative state loaded/staged/committed by the session;
- `getPending()` reads the current pending transaction from that state;
- `requiresRecovery()` tells you whether a previous ambiguous write could not yet be reloaded;
- `DurablePendingTransactionRecoveryRequiredError` prevents unsafe mutation retries until `load()` succeeds;
- `DurablePendingTransactionInvariantError` catches adapters that resolve without proving the requested staged/committed state.

## Example

```ts
type PendingReward = {
  id: string;
  coins: number;
};

type Save = {
  coins: number;
  pendingReward: PendingReward | null;
  lastCommittedRewardId: string | null;
};

const persist = async (next: Save): Promise<Save> => {
  await repository.write(next);
  return next;
};

const rewards = new DurablePendingTransactionSession<Save, PendingReward>({
  load: () => repository.load(),
  getPending: (state) => state.pendingReward,
  createPending: () => ({
    id: crypto.randomUUID(),
    coins: rollReward(),
  }),
  stage: (state, pending) => persist({
    ...state,
    pendingReward: pending,
  }),
  commit: (state, pending) => persist({
    ...state,
    coins: state.coins + pending.coins,
    pendingReward: null,
    lastCommittedRewardId: pending.id,
  }),
  isSamePending: (left, right) => left.id === right.id,
  isCommitted: (state, pending) =>
    state.pendingReward === null && state.lastCommittedRewardId === pending.id,
});

await rewards.load();
const reward = await rewards.prepare();
await showRewardPresentation(reward);
await rewards.commit();
```

If the app closes after `prepare()`, the next activation loads the same pending reward and `prepare()` returns it instead of calling `createPending()` again.

## Ambiguous-write recovery

A rejected storage promise does not always prove the write failed. Some storage or network-backed APIs can persist data and then reject because acknowledgement, transport or later work failed.

For both `stage()` and `commit()` the session therefore does this:

```text
attempt write
→ write throws
→ reload authoritative state
→ accept success only if that state proves the exact attempted transition
```

For staging, `isSamePending()` must prove semantic transaction identity across serialization/reload. Do not use object identity for JSON-shaped transactions; compare a durable transaction id or equivalent immutable identity.

For committing, `isCommitted()` must prove that **this exact pending transaction** already produced its durable committed state.

If the write is ambiguous **and the recovery reload also fails**, the session enters recovery-required mode. Further `prepare()`/`commit()` calls throw `DurablePendingTransactionRecoveryRequiredError` until `load()` succeeds. This deliberately prevents a blind reroll or double-apply while durable truth is unknown.

## Adapter contract

The utility is only as safe as its adapter. The consuming game must obey these rules:

1. `createPending()` resolves the transaction but does not persist/apply its durable effects.
2. `stage()` persists the exact pending transaction before resolving.
3. `commit()` writes a deterministic committed state derived from the already-staged pending transaction.
4. `isSamePending()` uses durable semantic identity that survives reload.
5. `isCommitted()` can distinguish this exact transaction from an unrelated later state.
6. Retryable commits should be snapshot/state-replacement operations, not non-idempotent remote side effects.

If a remote backend exposes non-idempotent commands such as `chargeCard()` or `incrementBalance()`, use the backend's own idempotency-key/transaction API. This helper does not manufacture server-side exactly-once semantics.

## What it deliberately does not own

The kit does **not** decide:

- save schema or serialization;
- reward/economy shape;
- RNG or loot policy;
- transaction-id format;
- cloud conflict resolution;
- whether presentation is replayed after recovery;
- how errors are shown to the player;
- external server/payment idempotency.

It only owns the local lifecycle and the safety rule: **never create/apply another transaction while the outcome of the previous durable write is unknown.**

## Provenance

Extracted from the proven `OpeningSession` / `pendingReveal` pattern in Signal 2000 (`DanilaH/cases-yg`). The shared contract intentionally removes CHIPS, Signal, Overcharge, Hidden Pocket, loot-pool and collection types.

It also strengthens the source behavior: if an ambiguous write is followed by a failed recovery reload, mutation is explicitly blocked until a successful `load()` re-establishes authoritative durable state.
