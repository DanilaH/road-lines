export interface DurablePendingTransactionAdapter<State, Pending> {
  /** Reload the authoritative durable state. */
  load(): Promise<State>;
  /** Return the currently staged transaction, if one exists. */
  getPending(state: State): Pending | null;
  /** Resolve a new transaction from the current durable base state. Must not persist it. */
  createPending(state: State): Pending | Promise<Pending>;
  /** Persist the exact pending transaction without applying its durable effects yet. */
  stage(state: State, pending: Pending): Promise<State>;
  /** Persist the deterministic committed state for this pending transaction. */
  commit(state: State, pending: Pending): Promise<State>;
  /** Semantic identity check that survives serialization/reload. */
  isSamePending(left: Pending, right: Pending): boolean;
  /** Prove from durable state that this exact transaction has already committed. */
  isCommitted(state: State, pending: Pending): boolean;
}

export class DurablePendingTransactionInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DurablePendingTransactionInvariantError';
  }
}

export class DurablePendingTransactionRecoveryRequiredError extends Error {
  public constructor() {
    super('A previous durable write is ambiguous and recovery reload has not succeeded; call load() before retrying a mutation');
    this.name = 'DurablePendingTransactionRecoveryRequiredError';
  }
}

/**
 * Small transaction kernel for interruption-safe staged durable work.
 *
 * The game owns State, Pending, persistence, reward/economy policy and transaction identity.
 * This class only enforces the lifecycle:
 *
 * base state -> durable pending -> presentation/other work -> deterministic commit
 *
 * If a write rejects after it may already have become durable, the session reloads and
 * accepts success only when the reloaded state proves the exact attempted transition.
 */
export class DurablePendingTransactionSession<State, Pending> {
  private state!: State;
  private loaded = false;
  private recoveryRequired = false;

  public constructor(private readonly adapter: DurablePendingTransactionAdapter<State, Pending>) {}

  public async load(): Promise<State> {
    try {
      const state = await this.adapter.load();
      this.state = state;
      this.loaded = true;
      this.recoveryRequired = false;
      return state;
    } catch (error: unknown) {
      if (this.loaded) this.recoveryRequired = true;
      throw error;
    }
  }

  public getState(): State {
    if (!this.loaded) {
      throw new Error('Durable pending transaction session accessed before load()');
    }
    return this.state;
  }

  public getPending(): Pending | null {
    return this.adapter.getPending(this.getState());
  }

  public requiresRecovery(): boolean {
    return this.recoveryRequired;
  }

  public async prepare(): Promise<Pending> {
    this.assertMutationSafe();
    const current = this.getState();
    const existing = this.adapter.getPending(current);
    if (existing !== null) return existing;

    const pending = await this.adapter.createPending(current);

    try {
      const staged = await this.adapter.stage(current, pending);
      const stagedPending = this.adapter.getPending(staged);
      if (stagedPending === null || !this.adapter.isSamePending(stagedPending, pending)) {
        throw new DurablePendingTransactionInvariantError(
          'stage() resolved without returning state that contains the exact pending transaction',
        );
      }
      this.state = staged;
      return stagedPending;
    } catch (error: unknown) {
      const recovery = await this.tryReloadAfterAmbiguousWrite();
      if (recovery.ok) {
        const recoveredPending = this.adapter.getPending(recovery.state);
        if (recoveredPending !== null && this.adapter.isSamePending(recoveredPending, pending)) {
          return recoveredPending;
        }
      }
      throw error;
    }
  }

  public async commit(): Promise<State> {
    this.assertMutationSafe();
    const current = this.getState();
    const pending = this.adapter.getPending(current);
    if (pending === null) return current;

    try {
      const committed = await this.adapter.commit(current, pending);
      if (!this.adapter.isCommitted(committed, pending)) {
        throw new DurablePendingTransactionInvariantError(
          'commit() resolved without returning state that proves the exact pending transaction committed',
        );
      }
      this.state = committed;
      return committed;
    } catch (error: unknown) {
      const recovery = await this.tryReloadAfterAmbiguousWrite();
      if (recovery.ok && this.adapter.isCommitted(recovery.state, pending)) {
        return recovery.state;
      }
      throw error;
    }
  }

  private assertMutationSafe(): void {
    if (this.recoveryRequired) {
      throw new DurablePendingTransactionRecoveryRequiredError();
    }
  }

  private async tryReloadAfterAmbiguousWrite(): Promise<
    | { ok: true; state: State }
    | { ok: false }
  > {
    this.recoveryRequired = true;
    try {
      const state = await this.adapter.load();
      this.state = state;
      this.loaded = true;
      this.recoveryRequired = false;
      return { ok: true, state };
    } catch {
      return { ok: false };
    }
  }
}
