# Storage adapters

Import from `@danilah/mini-games-kit/platform`.

## What it is

A minimal async key/value contract used by reusable persistence utilities.

## Public API

```ts
interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const storage = new WebStorageAdapter(window.localStorage);
```

The async interface intentionally works for both synchronous Web Storage and remote/platform-backed implementations.

## Non-goals

No schema validation, migrations, conflict resolution or transactional semantics are implied. Those belong in a repository/session layer above the adapter.
