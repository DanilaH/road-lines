import { describe, expect, it } from 'vitest';
import { GameAnalytics, levelInfo } from '../src/services/analytics';
import { levels } from '../src/content/levels';
const l = levels[2]!;
function harness() { const events: { event: string; params: any }[] = []; let time = 0; const analytics = new GameAnalytics({ track(event, params) { events.push({ event, params }); } }, () => time); return { events, analytics, advance(ms: number) { time += ms; } }; }
describe('game analytics boundaries', () => {
  it('counts first move once and excludes overlapping blocked time from completion', () => {
    const h = harness(); h.analytics.enter(l, 2, false); h.advance(100); h.analytics.enter(l, 2, false);
    h.analytics.move(2, 3); h.analytics.move(3, 4); h.advance(100); h.analytics.block(true); h.analytics.block(true);
    h.advance(9000); h.analytics.block(false); h.analytics.block(false); h.advance(300); h.analytics.finish(20); h.analytics.finish(20); h.analytics.leave('navigation');
    expect(h.events.map(e => e.event)).toEqual(['level_start', 'first_move', 'level_pause', 'level_complete']);
    expect(h.events[0]!.params).toMatchObject({ resumed: true, replay: false, attempt: 1 });
    expect(h.events[1]!.params.active_ms).toBe(100); expect(h.events[3]!.params).toMatchObject({ active_ms: 500, first_clear: true, reward: 20 });
  });
  it('separates resets, gesture undo, and suggested rollback without synthetic first moves', () => {
    const h = harness(); h.analytics.enter(l, 4, true); h.analytics.move(4, 2, 'rollback'); h.analytics.move(2, 1, 'reset'); h.analytics.move(1, 2); h.analytics.move(2, 1); h.analytics.finish(0);
    expect(h.events.filter(e => e.event === 'first_move')).toHaveLength(1);
    expect(h.events.at(-1)!.params).toMatchObject({ resets: 1, undo_cells: 1, first_clear: false, reward: 0 });
  });
  it('ends an unfinished visit once, starts a new visit on resume, and ignores disposed calls', () => {
    const h = harness(); h.analytics.block(true); h.analytics.enter(l, 2, false); h.advance(5000); h.analytics.block(false); h.advance(30); h.analytics.leave('navigation'); h.analytics.leave('navigation');
    h.analytics.enter(l, 2, false); h.advance(20); h.analytics.dispose(); h.analytics.dispose(); h.analytics.enter(l, 2, false); h.analytics.event('app_ready', { language: 'ru' });
    expect(h.events.map(e => e.event)).toEqual(['level_start', 'level_exit', 'level_start', 'level_exit']);
    expect(h.events[1]!.params.active_ms).toBe(30); expect(h.events[3]!.params).toMatchObject({ attempt: 2, active_ms: 20 });
  });
  it('cannot turn a throwing transport into a gameplay exception and limits repeated save diagnostics', () => {
    const h = harness(); h.analytics.saveError('write'); h.analytics.saveError('hint'); expect(h.events).toHaveLength(1);
    const a = new GameAnalytics({ track() { throw Error('offline'); } }); expect(() => { a.enter(l, 1, false); a.move(1, 2); a.finish(20); a.dispose(); }).not.toThrow();
  });
  it('metadata contains rule flags and authored IDs, never a route, witness, wallet or error text', () => {
    for (const level of levels) {
      expect(Object.keys(levelInfo(level)).sort()).toEqual(['cells','checkpoints','finish','level_id','level_version','set_id','walls']);
      expect(levelInfo(level).level_id).toBe(level.id);
    }
  });
});
