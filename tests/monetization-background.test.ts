import { afterEach, describe, expect, it, vi } from 'vitest';
import { Monetization } from '../src/services/monetization';
import { createAdsBridge, type AdsBridge } from '../src/platform/ads';
import { GameStore, type SyncStorage } from '../src/services/save';
import type { GameAnalytics } from '../src/services/analytics';
import type { AdReceipt } from '../src/core/monetization';
import { levels } from '../src/content/levels';
vi.mock('../src/platform/ads', () => ({ createAdsBridge: vi.fn() }));
vi.mock('../src/platform/banner', () => ({ NativeBanner: class { setVisible() {} dispose() {} } }));
const receipt: AdReceipt = {schema:1,stream:'install',id:'earned',session:'earned',sequence:1,placement:'hint-coins',amount:150};
const deferred = <T>() => { let resolve!: (value:T)=>void; const promise = new Promise<T>(r=>{resolve=r;}); return {promise,resolve}; };
function setup() {
  vi.useFakeTimers();
  const data = new Map<string,string>();
  const disk: SyncStorage = {getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}};
  const store = new GameStore(disk), block=vi.fn(), settle=vi.fn(()=>true), refresh=vi.fn();
  const ads = {status:vi.fn(async()=>({rewarded:true,interstitial:true,banner:true,mode:'test'})),pending:vi.fn(async()=>({receipts:[] as AdReceipt[]})),acknowledge:vi.fn(async()=>{}),addListener:vi.fn(async()=>({remove:async()=>{}})),dispose:vi.fn(async()=>{}),prepareInterstitial:vi.fn(async()=>{})};
  vi.mocked(createAdsBridge).mockResolvedValue(ads as unknown as AdsBridge);
  const mon=new Monetization(store,disk,{event:vi.fn()} as unknown as GameAnalytics,block,settle,refresh,{} as HTMLElement);
  return {mon,store,ads,block,settle,disk};
}
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
describe('optional ad recovery never gates gameplay',()=>{
  it('a missing pending callback keeps one native call, no blockers or route cancellation',async()=>{
    const {mon,ads,block,settle,store}=setup();ads.pending.mockReturnValue(new Promise(()=>{}));
    await mon.init();await vi.advanceTimersByTimeAsync(6000);
    for(let i=0;i<8;i++){await vi.advanceTimersByTimeAsync(30000);mon.tick();await Promise.resolve();}
    store.path(levels[0]!,[0,1]);expect(store.state.path).toEqual([0,1]);
    expect(ads.pending).toHaveBeenCalledTimes(1);expect(block).not.toHaveBeenCalled();expect(settle).not.toHaveBeenCalled();mon.dispose();
  });
  it('offline errors retry automatically; late reward uses latest prefix and wallet exactly once',async()=>{
    const {mon,ads,store,block,settle,disk}=setup();ads.pending.mockRejectedValueOnce(Error('offline')).mockResolvedValue({receipts:[receipt]});
    await mon.init();await vi.advanceTimersByTimeAsync(0);
    store.path(levels[0]!,[0,1]);store.write({...store.state,coins:60});
    await vi.advanceTimersByTimeAsync(5000);mon.tick();await vi.advanceTimersByTimeAsync(0);
    expect(store.state.coins).toBe(210);expect(store.state.path).toEqual([0,1]);expect(settle).toHaveBeenCalledTimes(1);
    store.buyHints(1);await mon.recover();expect(store.state.coins).toBe(150);expect(new GameStore(disk).state.path).toEqual([0,1]);expect(block).not.toHaveBeenCalled();mon.dispose();
  });
  it('response after the deadline is retained and applied without another native query',async()=>{
    const {mon,ads,store}=setup(), pending=deferred<{receipts:AdReceipt[]}>();ads.pending.mockReturnValue(pending.promise);
    await mon.init();await vi.advanceTimersByTimeAsync(6000);store.path(levels[0]!,[0,1]);
    pending.resolve({receipts:[receipt]});await vi.advanceTimersByTimeAsync(0);mon.tick();await vi.advanceTimersByTimeAsync(0);
    expect(store.state.coins).toBe(150);expect(store.state.path).toEqual([0,1]);expect(ads.pending).toHaveBeenCalledTimes(1);mon.dispose();
  });
  it('lost ack does not lock purchases, duplicate the grant or pile up native calls',async()=>{
    const {mon,ads,store,block}=setup();ads.pending.mockResolvedValue({receipts:[receipt]});ads.acknowledge.mockReturnValue(new Promise(()=>{}));
    await mon.init();await vi.advanceTimersByTimeAsync(6000);expect(store.state.coins).toBe(150);expect(store.buyHints(1)).toBe(true);
    for(let i=0;i<3;i++){await vi.advanceTimersByTimeAsync(30000);mon.tick();await vi.advanceTimersByTimeAsync(0);}
    expect(store.state.coins).toBe(90);expect(ads.acknowledge).toHaveBeenCalledTimes(1);expect(block).not.toHaveBeenCalled();mon.dispose();
  });
  it('late callbacks after dispose cannot mutate save',async()=>{
    const {mon,ads,store,block}=setup(), pending=deferred<{receipts:AdReceipt[]}>();ads.pending.mockReturnValue(pending.promise);
    await mon.init();mon.dispose();pending.resolve({receipts:[receipt]});await vi.advanceTimersByTimeAsync(0);
    expect(store.state.coins).toBe(0);expect(block).not.toHaveBeenCalled();
  });
});
