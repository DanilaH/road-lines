# `JsonStorageRepository`

Import from `@danilah/mini-games-kit/platform`.

## What it is

A small persistence layer for versioned JSON state. It owns JSON parsing/serialization and write ordering; the game owns validation, migrations and domain invariants through an injected codec.

This is intended for saves, settings and other small state documents that sit on top of `StorageAdapter`.

## Public API

```ts
const settings = new JsonStorageRepository({
  storage,
  key: 'game.settings',
  createDefault: () => ({ version: 2, muted: false }),
  codec: {
    decode: (value) => migrateAndValidateSettings(value),
    encode: (state) => state,
  },
});

const current = await settings.load();
await settings.write({ ...current, muted: true });
await settings.flush();
```

`load()` is strict: malformed JSON or codec validation failures reject.

`loadOrDefault(onError)` is the explicit best-effort path for non-critical preferences. It reports the error and returns a fresh default value.

`write()` and `remove()` are serialized per repository instance. A failed write does not poison the queue; later writes can still run. `flush()` waits for the current queue tail.

## Migrations

Put schema/version migration in `codec.decode`:

```ts
codec: {
  decode(value) {
    const parsed = assertRecord(value);
    if (parsed.version === 1) return migrateV1(parsed);
    return validateV2(parsed);
  },
}
```

The repository intentionally does not know what a valid game save looks like.

## Guarantees

- missing key returns `createDefault()`;
- parsing happens before codec validation;
- writes use a serialized snapshot created when `write()` is called;
- write ordering is preserved for one repository instance;
- a rejected write does not block later writes.

## Non-goals

This is not a transaction system and does not provide cross-tab locking, cloud conflict resolution or server-side concurrency control. Use `DurablePendingTransactionSession` for staged exactly-once local state transitions and `YandexMirroredStorageAdapter` for Player Data mirroring.

Create one repository instance per key when write ordering matters; separate instances do not share a queue.
