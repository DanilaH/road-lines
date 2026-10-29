# Recoverable current-save repair

This is a persistence policy pattern built on the existing `JsonStorageRepository` / game codec seam. It is documented rather than exposed as a new framework API because one production game is not enough evidence for a universal repair engine.

Signal 2000 exposed an important distinction: a current-version save can contain valid durable progression while some transient or derived metadata is internally inconsistent. Treating every such case as total corruption can destroy legitimate player state.

Use three conceptual outcomes when decoding current-version state:

1. **accepted** — durable and transient invariants are coherent;
2. **repairable** — durable truth is sufficient to deterministically reconstruct or discard only unsafe transient/derived metadata;
3. **invalid** — preserving the save would require guessing durable gameplay truth.

A repair is allowed only when the replacement value follows deterministically from already-valid durable state. Typical candidates are stale cached/derived flags, presentation-owned metadata, or restartable session hints.

Do **not** repair by guessing an unresolved reward, rerolling RNG, recreating a charged/spent transaction from heuristics, or otherwise inventing durable progression. If pending transactional state is coherent, preserve it exactly. If it is not safely reconstructable, fail explicitly rather than silently changing the outcome.

The existing `JsonStateCodec.decode()` is the correct project-owned seam for migration/validation/repair today:

```ts
const codec: JsonStateCodec<GameSave> = {
  decode(value) {
    const migrated = migrateKnownVersions(value);
    const verdict = validateCurrentSave(migrated);
    if (verdict.kind === 'accepted') return verdict.state;
    if (verdict.kind === 'repairable') return repairCurrentSave(verdict.state, verdict.reason);
    throw new Error(verdict.reason);
  },
};
```

If a repaired state should become canonical, persist it intentionally after a successful load/reconciliation step. Do not let incidental presentation code own that write.

For mirrored/cloud storage, keep the ordering deterministic and documented: decode/migrate each candidate, apply the game's freshness/reconciliation policy, then validate the chosen canonical state according to the game's rules. Do not let a generic storage adapter invent conflict or repair semantics.

## Why this is not a public class yet

The reusable principle is strong; the exact repair result types and reconciliation order are still game-policy-heavy. A second real consumer should determine whether an exported `RepairResult`/codec helper actually saves work without constraining valid games.
