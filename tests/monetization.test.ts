import { describe, it, expect } from 'vitest';
import { GameStore, defaultSave, decodeSave, SAVE_KEY, type SyncStorage } from '../src/services/save';
import { AdCadence } from '../src/services/ad-cadence';
import type { AdReceipt } from '../src/core/monetization';
import { DurableReceiptQueue } from '../vendor/mini-games-kit/src/platform/durable-receipt-queue';
const memory = (): SyncStorage => { const m = new Map<string,string>(); return { getItem: k => m.get(k) ?? null, setItem: (k,v) => { m.set(k,v); } }; };
const receipt = (sequence=1): AdReceipt => ({ schema:1,id:`ad-${sequence}`,session:`ad-${sequence}`,stream:'install-a',sequence,placement:'hint-coins',amount:150 });
describe('monetization durable mutations',()=>{
  it('migrates v1-v4 without touching earned currency, hint stock or themed wheel outcome',()=>{
    for(const version of [1,2,3,4]) {
      const old={...defaultSave(),version,coins:711,hints:17};
      const next=decodeSave(JSON.stringify(old));expect(next.version).toBe(5);expect(next.coins).toBe(711);expect(next.hints).toBe(17);expect(next.adLedger.sequence).toBe(0);
    }
  });
  it('rejects malformed v5 ledger instead of resetting it',()=>{
    for(const adLedger of [null,{}, {stream:null,sequence:1,id:null},{stream:'x',sequence:0,id:'bad'}]) expect(()=>decodeSave(JSON.stringify({...defaultSave(),adLedger}))).toThrow();
  });
  it('buys only a known, affordable pack atomically and preserves stock on failure',()=>{
    const st=new GameStore(memory());st.write({...st.state,coins:150,hints:0});
    expect(st.buyHints(3)).toBe(true);expect(st.state.coins).toBe(0);expect(st.state.hints).toBe(3);
    expect(st.buyHints(1)).toBe(false);expect(st.state.hints).toBe(3);expect(()=>st.buyHints(9)).toThrow();
  });
  it('retains wallet/stock after rejected purchase writes and recovers authoritative snapshot',()=>{
    const disk=memory();let fail=false;
    const st=new GameStore({getItem:k=>disk.getItem(k),setItem:(k,v)=>{if(fail)throw Error('disk');disk.setItem(k,v);}});
    st.write({...st.state,coins:150,hints:0});fail=true;expect(()=>st.buyHints(3)).toThrow();
    expect(st.state.coins).toBe(150);expect(st.state.hints).toBe(0);fail=false;st.reload();expect(st.buyHints(3)).toBe(true);
  });
  it('persists reward and sequence together, restart/re-delivery cannot grant it twice',()=>{
    const disk=memory();const st=new GameStore(disk);expect(st.commitAdReceipt(receipt())).toBe('applied');
    const resumed=new GameStore(disk);expect(resumed.commitAdReceipt(receipt())).toBe('already-applied');
    expect(resumed.state.coins).toBe(150);resumed.commitAdReceipt(receipt(2));resumed.commitAdReceipt(receipt());expect(resumed.state.coins).toBe(300);
  });
  it('rejects forged amounts, changed stream, sequence gaps and same-sequence different identities',()=>{
    const st=new GameStore(memory());
    for(const r of [{...receipt(),amount:500},receipt(2),{...receipt(),placement:'x5'}])expect(()=>st.commitAdReceipt(r as AdReceipt)).toThrow();
    st.commitAdReceipt(receipt());
    for(const r of [{...receipt(2),stream:'other'},{...receipt(),id:'replaced'}]) expect(()=>st.commitAdReceipt(r)).toThrow();
    expect(st.state.coins).toBe(150);
  });
  it('readback handles write-then-throw and never lets a stale snapshot overwrite a grant',()=>{
    const disk=memory();const st=new GameStore({getItem:k=>disk.getItem(k),setItem:(k,v)=>{disk.setItem(k,v);throw Error('after commit');}});
    st.commitAdReceipt(receipt());expect(st.state.coins).toBe(150);
    const stale=new GameStore(disk);st.commitAdReceipt(receipt(2));expect(()=>stale.buyHints(1)).toThrow();expect(new GameStore(disk).state.coins).toBe(300);
  });
  it('failed grant is not acknowledged; ack failure then restart consumes exact pending receipt without regrant',async()=>{
    const disk=memory();let rejectWrite=true;let acked=0;
    let st=new GameStore({getItem:k=>disk.getItem(k),setItem:(k,v)=>{if(rejectWrite)throw Error('disk');disk.setItem(k,v);}});
    let rejectAck=true;
    const q=new DurableReceiptQueue<AdReceipt>({commit:async r=>st.commitAdReceipt(r),acknowledge:async id=>{expect(id).toBe('ad-1');if(rejectAck)throw Error('ack');acked++;}});
    await expect(q.deliver(receipt())).rejects.toThrow();expect(acked).toBe(0);
    rejectWrite=false;st.reload();await expect(q.deliver(receipt())).rejects.toThrow();expect(st.state.coins).toBe(150);
    st=new GameStore(disk);rejectAck=false;await q.deliver(receipt());expect(st.state.coins).toBe(150);expect(acked).toBe(1);
  });
});
describe('approved active-time ad cadence',()=>{
  it('requires 60 active seconds AND five first clears; replay never qualifies',()=>{
    const disk=memory();let t=0;const c=new AdCadence(disk,()=>t);c.setActive(true);t=59999;expect(c.eligible(5,'a',true)).toBe(false);t=60000;expect(c.eligible(4,'a',true)).toBe(false);expect(c.eligible(5,'a',true)).toBe(true);expect(c.eligible(5,'a',false)).toBe(false);
  });
  it('uses shared 90-second AND three-new-clear cooldown after rewarded, excludes background',()=>{
    let t=0;const c=new AdCadence(memory(),()=>t);c.setActive(true);t=60000;c.begin(5);t+=30000;c.end(5,true);
    c.setActive(true);t+=89999;expect(c.eligible(8,'b',true)).toBe(false);t++;expect(c.eligible(7,'b',true)).toBe(false);expect(c.eligible(8,'b',true)).toBe(true);
    c.setActive(false);const active=c.state.activeMs;t+=100000;expect(c.state.activeMs).toBe(active);
  });
  it('preserves gift protection and active cooldown across restart, with no wall-clock shortcut',()=>{
    const disk=memory();let t=0;let c=new AdCadence(disk,()=>t);c.setActive(true);t=60000;c.begin(20);c.end(20,true);c.protect('gift');
    t=5000000;c=new AdCadence(disk,()=>t);expect(c.eligible(23,'x',true)).toBe(false);c.setActive(true);t+=90000;expect(c.eligible(23,'gift',true)).toBe(false);expect(c.eligible(23,'x',true)).toBe(true);
  });
  it('interrupted fullscreen requires a new interval; failed cadence persistence disables forced ads',()=>{
    const disk=memory();let t=0;let c=new AdCadence(disk,()=>t);c.setActive(true);t=60000;c.begin(5);c=new AdCadence(disk,()=>t);expect(c.eligible(8,'x',true)).toBe(false);
    const bad=new AdCadence({getItem:()=>null,setItem:()=>{throw Error('disk');}},()=>t);bad.setActive(true);t+=100000;expect(bad.eligible(5,'x',true)).toBe(false);
  });
});
