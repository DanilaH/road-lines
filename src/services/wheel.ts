import { DurablePendingTransactionSession } from '../../vendor/mini-games-kit/src/core/durable-pending-transaction';
import { canSpin, type WheelSpin } from '../core/rewards';
import { GameStore, type GameSave } from './save';
import { themes } from '../content/themes';
import { rareThemeSector } from '../core/rewards';
/** Adapter mutations use the current sole writer, never a captured full snapshot. */
export class WheelService {
  private session: DurablePendingTransactionSession<GameSave, WheelSpin>;
  private date = '';
  private busy = false;
  private disposed = false;
  private assertLive(): void { if (this.disposed) throw Error('Disposed wheel'); }
  dispose(): void { this.disposed = true; }
  constructor(private store: GameStore, private sector = () => crypto.getRandomValues(new Uint32Array(1))[0]! % 8, private id: () => string = () => crypto.randomUUID(),
    private themeIndex = (count: number) => crypto.getRandomValues(new Uint32Array(1))[0]! % count) {
    this.session = new DurablePendingTransactionSession({
      load: async () => { this.assertLive(); return this.store.reload(); }, getPending: s => s.daily.pending,
      createPending: s => {
        if (!canSpin(s, this.date)) throw Error('Daily spin unavailable');
        const sector = this.sector(), candidates = themes.filter(t => t.price > 0 && !s.ownedThemes.includes(t.id));
        const themeId = sector === rareThemeSector && candidates.length ? candidates[this.themeIndex(candidates.length)]?.id : undefined;
        if (sector === rareThemeSector && candidates.length && !themeId) throw Error('Invalid theme choice');
        return { id: this.id(), date: this.date, sector, ...(themeId ? { themeId } : {}) };
      },
      stage: async (_s, pending) => { this.assertLive(); this.store.stageSpin(pending); return this.store.state; },
      commit: async (_s, pending) => { this.assertLive(); this.store.commitSpin(pending.id); return this.store.state; },
      isSamePending: (a, b) => a.id === b.id && a.date === b.date && a.sector === b.sector && a.themeId === b.themeId,
      isCommitted: (s, p) => s.daily.pending === null && s.daily.last?.id === p.id && s.daily.last.sector === p.sector && s.daily.last.date === p.date && s.daily.last.themeId === p.themeId,
    });
  }
  async prepare(date: string): Promise<WheelSpin> {
    if (this.busy) throw Error('Wheel operation in progress'); this.busy = true;
    try { this.date = date; await this.session.load(); return await this.session.prepare(); } finally { this.busy = false; }
  }
  async commit(): Promise<void> {
    if (this.busy) throw Error('Wheel operation in progress'); this.busy = true;
    try { await this.session.load(); await this.session.commit(); } finally { this.busy = false; }
  }
}
