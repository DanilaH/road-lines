import { describe, it, expect } from 'vitest';
import { canSpin, giftReward, initialRewards, localDate, offerDue, wheelAngle, wheelPrizes } from '../src/core/rewards';
import { GameStore, defaultSave, decodeSave } from '../src/services/save';
import { WheelService } from '../src/services/wheel';
import { levels } from '../src/content/levels';
const day = '2026-10-30';
const memory = () => { let raw: string | null = null; return { getItem: () => raw, setItem: (_k: string, v: string) => { raw = v; } }; };
describe('gift and offer policy', () => {
  it('grants each 20-first-clear milestone once, including multiple milestones', () => {
    for (let count = 0; count <= 90; count++) {
      const previous = Math.floor(Math.max(0, count - 1) / 20), next = giftReward(count, previous);
      expect(next.coins).toBe(count > 0 && count % 20 === 0 ? 100 : 0);
      expect(giftReward(count, next.milestones).coins).toBe(0);
    }
    expect(giftReward(60, 0)).toEqual({ milestones: 3, coins: 300 }); expect(() => giftReward(19, 1)).toThrow();
  });
  it('offers at 10, then at least 20 completions apart', () => {
    expect(offerDue(9, 0)).toBe(false); expect(offerDue(10, 0)).toBe(true);
    expect(offerDue(29, 10)).toBe(false); expect(offerDue(30, 10)).toBe(true);
  });
  it('persists the tenth-clear target and does not recreate it on replay', () => {
    const storage = memory(), store = new GameStore(storage);
    for (const level of levels.slice(0, 10)) store.finish(level, level.witness);
    expect(new GameStore(storage).state).toMatchObject({ coins: 200, lastOfferAt: 10, offer: { levelId: levels[9]!.id, themeId: 'lagoon', milestone: 10 } });
    store.dismissOffer(); store.finish(levels[9]!, levels[9]!.witness);
    expect(new GameStore(storage).state).toMatchObject({ coins: 200, lastOfferAt: 10, offer: null });
  });
  it('never redirects an old offer to another level or an owned theme', () => {
    const store = new GameStore(memory()); for (const l of levels.slice(0, 10)) store.finish(l, l.witness);
    store.path(levels[10]!, [levels[10]!.start]); expect(store.state.offer).toBeNull();
    const all = new GameStore(memory()); all.write({ ...all.state, coins: 3000 });
    for (const id of ['lagoon','sunset','lavender','honey','dusk','neon']) all.selectTheme(id);
    for (const l of levels.slice(0, 10)) all.finish(l, l.witness); expect(all.state.offer).toBeNull();
  });
  it('migrates v2 without resetting ownership or progression', () => {
    expect(decodeSave(JSON.stringify({ ...defaultSave(), version: 2, coins: 70, themeId: 'mint', completed: ['intro-01'] }))).toMatchObject({ version: 3, coins: 70, themeId: 'mint', completed: ['intro-01'], ...initialRewards() });
  });
});
describe('durable daily wheel', () => {
  it('stages a fixed result before animation and recovers without rerolling', async () => {
    const storage = memory(), store = new GameStore(storage), service = new WheelService(store, () => 4, () => 'spin-a');
    expect(await service.prepare(day)).toEqual({ id: 'spin-a', date: day, sector: 4 }); expect(store.state.coins).toBe(0);
    const reload = new GameStore(storage), recovery = new WheelService(reload, () => { throw Error('reroll'); });
    expect((await recovery.prepare('2026-10-31')).id).toBe('spin-a'); await recovery.commit(); await recovery.commit();
    expect(new GameStore(storage).state).toMatchObject({ coins: 100, daily: { lastDate: day, pending: null, last: { id: 'spin-a', sector: 4 } } });
  });
  it('does not restore an attempt after moving the date backwards', async () => {
    const store = new GameStore(memory()), service = new WheelService(store, () => 0, () => 'a'); await service.prepare(day); await service.commit();
    expect(canSpin(store.state, day)).toBe(false); expect(canSpin(store.state, '2026-10-29')).toBe(false); expect(canSpin(store.state, '2026-10-31')).toBe(true);
    await expect(service.prepare(day)).rejects.toThrow('unavailable');
  });
  it('rebases commit on current state, preserving purchases, paths and rewards', async () => {
    const store = new GameStore(memory()); store.write({ ...store.state, coins: 500 });
    const service = new WheelService(store, () => 7, () => 'a'); await service.prepare(day);
    store.selectTheme('dusk'); store.path(levels[0]!, [0, 1]); store.finish(levels[0]!, levels[0]!.witness); await service.commit();
    expect(store.state).toMatchObject({ coins: 320, themeId: 'dusk', completed: ['intro-01'], path: [0, 1, 2] });
  });
  it('guards concurrent prepare and ignores stale commit ids', async () => {
    const store = new GameStore(memory()), service = new WheelService(store, () => 2, () => 'a');
    const one = service.prepare(day); await expect(service.prepare(day)).rejects.toThrow('progress'); await one;
    expect(() => store.commitSpin('wrong')).toThrow('Stale'); expect(store.state.coins).toBe(0);
  });
  it('does not consume a failed stage and verifies a lost acknowledgement', async () => {
    const backing = memory(), seed = new GameStore(backing); seed.path(levels[0]!, [0]);
    const failed = new GameStore({ getItem: backing.getItem, setItem: () => { throw Error('full'); } });
    await expect(new WheelService(failed, () => 0, () => 'a').prepare(day)).rejects.toThrow(); expect(canSpin(new GameStore(backing).state, day)).toBe(true);
    const uncertain = new GameStore({ getItem: backing.getItem, setItem: (k, v) => { backing.setItem(k, v); throw Error('lost ack'); } });
    const service = new WheelService(uncertain, () => 5, () => 'b'); await service.prepare(day); await service.commit(); expect(new GameStore(backing).state.coins).toBe(150);
  });
  it('retains a pending result after failed commit and grants once after reload', async () => {
    const backing = memory(), store = new GameStore(backing); await new WheelService(store, () => 3, () => 'a').prepare(day);
    const failed = new GameStore({ getItem: backing.getItem, setItem: () => { throw Error('full'); } }); await expect(new WheelService(failed).commit()).rejects.toThrow();
    expect(new GameStore(backing).state.daily.pending?.sector).toBe(3);
    const restored = new GameStore(backing); await new WheelService(restored).commit(); expect(restored.state.coins).toBe(75);
  });
  it('rejects corrupt reward and wheel ledgers instead of resetting state', () => {
    for (const patch of [{ daily: undefined }, { giftMilestones: 1 }, { giftNotice: 20 }, { lastOfferAt: 10 }, { daily: { lastDate: day, pending: { id: 'a', date: day, sector: 8 }, last: null } }, { daily: { lastDate: day, pending: null, last: null } }]) expect(() => decodeSave(JSON.stringify({ ...defaultSave(), ...patch }))).toThrow();
  });
  it('does not write after disposal while awaiting its next stage', async () => {
    const store = new GameStore(memory()), service = new WheelService(store, () => 1, () => 'a'); const pending = service.prepare(day); service.dispose();
    await expect(pending).rejects.toThrow('Disposed'); expect(store.state.daily.pending).toBeNull();
  });
  it('maps every equal sector precisely under the top pointer', () => {
    expect(wheelPrizes).toEqual([20, 30, 50, 75, 100, 150, 200, 300]); for (let i=0;i<8;i++) expect((wheelAngle(i)+i*45)%360).toBe(0);
    expect(localDate(new Date(2026,9,30,23,59))).toBe(day);
  });
});
