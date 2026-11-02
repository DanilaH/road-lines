import { describe, expect, it } from 'vitest';
import { levels } from '../src/content/levels';
import { GameStore, SAVE_KEY, type SyncStorage } from '../src/services/save';
import { wheelPrizes } from '../src/core/rewards';

type Fault = 'before' | 'after' | 'unreadable';
function disk() {
  let raw: string | null = null, fault: Fault | null = null, unreadable = false;
  const storage: SyncStorage = {
    getItem(key) { expect(key).toBe(SAVE_KEY); if (unreadable) throw Error('read unavailable'); return raw; },
    setItem(key, value) {
      expect(key).toBe(SAVE_KEY);
      if (fault === 'before') throw Error('quota');
      raw = value;
      if (fault === 'unreadable') unreadable = true;
      if (fault) throw Error('ack lost');
    },
  };
  return { storage, fail(mode: Fault) { fault = mode; }, recover() { fault = null; unreadable = false; } };
}
const l = levels[0]!;
const operations = [
  { name: 'first clear', seed(s: GameStore) { s.path(l, [0, 1]); }, run(s: GameStore) { s.finish(l, l.witness); } },
  { name: 'twentieth clear and gift', seed(s: GameStore) { for (const x of levels.slice(0, 19)) s.finish(x, x.witness); }, run(s: GameStore) { s.finish(levels[19]!, levels[19]!.witness); } },
  { name: 'hint debit and current prefix', seed(s: GameStore) { s.path(l, [0, 1]); }, run(s: GameStore) { s.write({ ...s.state, hints: s.state.hints - 1 }); } },
  { name: 'theme purchase', seed(s: GameStore) { s.write({ ...s.state, coins: 700 }); }, run(s: GameStore) { s.selectTheme('dusk'); } },
  { name: 'wheel stage', seed(s: GameStore) { s.path(l, [0, 1]); }, run(s: GameStore) { s.stageSpin({ id: 'fixed', date: '2026-11-01', sector: 7 }); } },
  { name: 'wheel commit', seed(s: GameStore) { s.stageSpin({ id: 'fixed', date: '2026-11-01', sector: 7 }); }, run(s: GameStore) { s.commitSpin('fixed'); } },
  { name: 'theme wheel stage', seed(s: GameStore) { s.path(l, [0, 1]); }, run(s: GameStore) { s.stageSpin({ id: 'theme', date: '2026-11-02', sector: 7, themeId: 'dusk' }); } },
  { name: 'theme wheel commit', seed(s: GameStore) { s.stageSpin({ id: 'theme', date: '2026-11-02', sector: 7, themeId: 'dusk' }); }, run(s: GameStore) { s.commitSpin('theme'); } },
  { name: 'gift acknowledgement', seed(s: GameStore) { for (const x of levels.slice(0, 20)) s.finish(x, x.witness); }, run(s: GameStore) { s.acknowledgeGift(); } },
  { name: 'offer dismissal', seed(s: GameStore) { for (const x of levels.slice(0, 10)) s.finish(x, x.witness); }, run(s: GameStore) { s.dismissOffer(); } },
];

describe('save transaction fault boundaries', () => {
  for (const operation of operations) for (const fault of ['before', 'after', 'unreadable'] as const) {
    it(`${operation.name}: ${fault} write failure has exactly old or new durable state`, () => {
      const d = disk(), store = new GameStore(d.storage); operation.seed(store);
      const before = structuredClone(store.state);
      // An independent successful execution supplies the complete expected snapshot.
      const control = disk(), reference = new GameStore(control.storage); reference.write(before); operation.run(reference);
      const after = structuredClone(reference.state);
      d.fail(fault);
      if (fault === 'after') { operation.run(store); expect(store.state).toEqual(after); expect(store.recoveryRequired).toBe(false); }
      else {
        expect(() => operation.run(store)).toThrow(); expect(store.state).toEqual(before); expect(store.recoveryRequired).toBe(true);
        expect(() => store.path(l, [l.start])).toThrow('reload required');
      }
      d.recover();
      const restored = new GameStore(d.storage);
      expect(restored.state).toEqual(fault === 'before' ? before : after);
      store.reload(); expect(store.state).toEqual(restored.state);
      if (fault === 'before') operation.run(store);
      expect(new GameStore(d.storage).state).toEqual(after);
      // Replaying idempotent transactions must not charge/grant twice.
      if (!['hint debit and current prefix', 'wheel stage', 'theme wheel stage'].includes(operation.name)) {
        operation.run(store); expect(new GameStore(d.storage).state).toEqual(after);
      }
    });
  }
  it('preserves every first clear and all four gifts through 90 mixed failure/restart boundaries', () => {
    const d = disk(); let store = new GameStore(d.storage);
    for (const [i, level] of levels.entries()) {
      d.fail((['before', 'after', 'unreadable'] as const)[i % 3]!);
      try { store.finish(level, level.witness); } catch { /* Restart decides ownership. */ }
      d.recover(); store = new GameStore(d.storage); store.finish(level, level.witness);
      store = new GameStore(d.storage); store.finish(level, level.witness);
      expect(store.state.coins).toBe((i + 1) * 20 + Math.floor((i + 1) / 20) * 100);
      expect(store.state.completed).toEqual(levels.slice(0, i + 1).map(x => x.id));
    }
    expect(store.state.coins).toBe(2200); expect(store.state.giftMilestones).toBe(4);
  });
  it('commits all eight wheel sectors once despite lost confirmation and restarts', () => {
    const d = disk(); let store = new GameStore(d.storage);
    for (let sector = 0; sector < 8; sector++) {
      const id = `sector-${sector}`;
      store.stageSpin({ id, date: `2026-11-0${sector + 1}`, sector });
      d.fail('unreadable'); expect(() => store.commitSpin(id)).toThrow(); d.recover();
      store = new GameStore(d.storage); store.commitSpin(id); store.commitSpin(id);
      expect(store.state.coins).toBe(wheelPrizes.slice(0, sector + 1).reduce((a, b) => a + b, 0));
    }
  });
  it('blocks stale prefix, hint, theme and wheel writers after a reward in another instance', () => {
    for (const action of [
      (s: GameStore) => s.path(l, [0, 1]),
      (s: GameStore) => s.write({ ...s.state, hints: s.state.hints - 1 }),
      (s: GameStore) => s.selectTheme('mint'),
      (s: GameStore) => s.stageSpin({ id: 'stale', date: '2026-11-01', sector: 7 }),
    ]) {
      const d = disk(), current = new GameStore(d.storage); current.path(l, [0]);
      const stale = new GameStore(d.storage); current.finish(l, l.witness);
      const durable = structuredClone(current.state);
      expect(() => action(stale)).toThrow('another writer');
      expect(() => action(stale)).toThrow('reload required');
      expect(new GameStore(d.storage).state).toEqual(durable);
    }
  });
});
