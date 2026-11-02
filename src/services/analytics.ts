import type { AnalyticsAdapter, AnalyticsParams } from '../../vendor/mini-games-kit/src/platform/analytics';
import type { Level } from '../core/model';
import { getLevelSet } from '../core/progression';

type LevelInfo = { level_id: string; level_version: number; set_id: string; cells: number; finish: boolean; walls: boolean; checkpoints: boolean };
export const levelInfo = (l: Level): LevelInfo => ({ level_id: l.id, level_version: l.version, set_id: getLevelSet(l.id).id, cells: l.cells.length,
  finish: l.finish !== undefined, walls: Boolean(l.walls?.length), checkpoints: Boolean(l.checkpoints?.length) });
export interface Events {
  app_ready: { language: string };
  startup_error: { reason: 'ownership' | 'save_or_boot' };
  level_start: LevelInfo & { attempt: number; resumed: boolean; replay: boolean };
  first_move: LevelInfo & { attempt: number; active_ms: number };
  level_complete: LevelInfo & { attempt: number; active_ms: number; first_clear: boolean; reward: number; resets: number; undo_cells: number };
  level_exit: LevelInfo & { attempt: number; active_ms: number; reason: string; filled: number; resets: number; undo_cells: number };
  level_pause: LevelInfo & { attempt: number; active_ms: number; filled: number };
  level_reset: LevelInfo & { attempt: number };
  hint_request: LevelInfo;
  hint_result: LevelInfo & { outcome: 'found' | 'dead_end' | 'unknown' | 'cancelled' | 'no_budget' | 'save_failed' };
  hint_spent: LevelInfo & { remaining: number };
  hint_repeat: LevelInfo;
  theme_purchase: { theme: string; price: number };
  theme_selected: { theme: string };
  wheel_reward: { sector: number; amount: number; recovered: boolean; theme?: string };
  save_error: { operation: string };
  save_conflict: Record<string, never>;
  language_change: { language: string; saved: boolean };
}
/** No raw save/path/error strings, timer, persistent ID, or durable analytics outbox. */
export class GameAnalytics {
  private attempt?: { info: LevelInfo; number: number; active: number; since: number | null; moved: boolean; resets: number; undo: number; filled: number };
  private serial = 0;
  private blocked = false;
  private disposed = false;
  private errorReported = false;
  constructor(private sink: AnalyticsAdapter, private now = () => performance.now()) {}
  event<K extends keyof Events>(name: K, params: Events[K]): void {
    if (this.disposed) return;
    // Analytics never participates in success/failure of game mutations.
    try { this.sink.track(name, { schema: 1, ...params } as AnalyticsParams); } catch { /* Best effort. */ }
  }
  enter(level: Level, filled: number, replay: boolean): void {
    if (this.disposed || this.attempt?.info.level_id === level.id) return;
    this.leave('selection');
    this.attempt = { info: levelInfo(level), number: ++this.serial, active: 0, since: this.blocked ? null : this.now(), moved: false, resets: 0, undo: 0, filled };
    this.event('level_start', { ...this.attempt.info, attempt: this.serial, resumed: filled > 1, replay });
  }
  private elapsed(): number {
    const a = this.attempt;
    return a ? Math.max(0, Math.round(a.active + (a.since === null ? 0 : Math.max(0, this.now() - a.since)))) : 0;
  }
  block(value: boolean): void {
    if (value === this.blocked) return;
    const a = this.attempt;
    if (a) {
      if (value) { a.active = this.elapsed(); a.since = null; this.event('level_pause', { ...a.info, attempt: a.number, active_ms: this.elapsed(), filled: a.filled }); }
      else a.since = this.now();
    }
    this.blocked = value;
  }
  move(before: number, after: number, kind: 'gesture' | 'reset' | 'rollback' = 'gesture'): void {
    const a = this.attempt; if (!a || this.blocked || before === after) return;
    a.filled = after;
    if (kind === 'reset') { a.resets++; this.event('level_reset', { ...a.info, attempt: a.number }); }
    else if (kind === 'gesture') a.undo += Math.max(0, before - after);
    if (!a.moved && kind === 'gesture') { a.moved = true; this.event('first_move', { ...a.info, attempt: a.number, active_ms: this.elapsed() }); }
  }
  finish(reward: number): void {
    const a = this.attempt; if (!a) return;
    this.event('level_complete', { ...a.info, attempt: a.number, active_ms: this.elapsed(), first_clear: reward > 0, reward, resets: a.resets, undo_cells: a.undo });
    this.attempt = undefined;
  }
  leave(reason: string): void {
    const a = this.attempt; if (!a) return;
    this.event('level_exit', { ...a.info, attempt: a.number, active_ms: this.elapsed(), reason, filled: a.filled, resets: a.resets, undo_cells: a.undo });
    this.attempt = undefined;
  }
  saveError(operation: string): void { if (!this.errorReported) { this.errorReported = true; this.event('save_error', { operation }); } }
  dispose(): void { this.leave('dispose'); this.disposed = true; }
}
