// Checks resource budgets in a completed current-source long soak + GL supplement.
// V8 heap budgets flag sustained growth; they are not a proof of zero leaks/native RSS.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir='.test-output/performance-audit';
const main=JSON.parse(readFileSync(dir+'/results.json','utf8'));
const gl=JSON.parse(readFileSync(dir+'/supplement.json','utf8'));
const hash=createHash('sha256');for(const f of readdirSync('src',{recursive:true}).filter(f=>statSync('src/'+f).isFile()).sort()){const p='src/'+f;hash.update(p+'\0').update(readFileSync(p)).update('\0');}
const sourceSha256=hash.digest('hex');
for(const r of [main,gl]){assert.equal(r.sourceSha256,sourceSha256,'Evidence must match current source');assert.deepEqual(r.errors,[]);}
const ui=main.memory.filter(m=>m.label.startsWith('UI ')),first=ui[0],last=ui.at(-1),tail=ui.slice(-3);
assert.equal(last.label,'UI cycles 102','Run --long-soak before checking');
for(const row of main.memory){
 assert.deepEqual(row.dom,first.dom,'DOM/documents/listeners must remain constant after warmup');
 for(const [k,v]of Object.entries(row.state.queues))assert.equal(v,0,`${row.label}: ${k} queue`);
 for(const k of ['raf','timeouts','workers','voices'])assert.equal(row.state.live[k],0,`${row.label}: active ${k}`);
 assert.equal(row.state.live.intervals,1,'Only the calendar interval remains');
 assert.equal(row.state.canvases,2);assert.equal(row.state.textures,first.state.textures);assert.equal(row.state.objects,first.state.objects);
}
const lateGrowth=last.usage.usedSize-tail[0].usage.usedSize,totalGrowth=last.usage.usedSize-first.usage.usedSize;
assert(lateGrowth<512*1024,'Last 24 UI cycles exceeded 512 KiB retained JS budget');
assert(totalGrowth<2*1024*1024,'Post-warmup retained JS growth exceeded 2 MiB budget');
const worker=main.resources.find(r=>r.label==='worker stress');assert.equal(worker.found,10);assert.equal(worker.cancelled,10);assert.equal(worker.workers,0);
for(const row of main.resources.filter(r=>r.label.startsWith('dispose-'))){
 assert.equal(row.after.canvases,0);assert.equal(row.after.pendingDestroy,false);
 for(const k of ['raf','timeouts','intervals','workers'])assert.equal(row.after.live[k],0,`${row.label}: ${k}`);
 // Oscillator 'ended' callbacks need not fire once AudioContext is closed.
 // Closed contexts establish release; the event counter alone does not.
 assert.equal(row.after.live.audioCreated,row.after.live.audioClosed);
}
assert.equal(gl.gl.length,4);const live=r=>Object.fromEntries(Object.entries(r.data).map(([k,v])=>[k,v.live]));
for(const row of gl.gl.slice(1))assert.deepEqual(live(row),live(gl.gl[0]),'GL live handles must remain bounded through 30 paused resizes');
assert.equal(gl.identicalPauseWrites,0);
const summary={sourceSha256,uiCycles:102,fxCycles:20,workerRequests:20,pausedResizes:30,dom:first.dom,firstHeap:first.usage.usedSize,lastHeap:last.usage.usedSize,late24CycleGrowth:lateGrowth,totalHeapGrowth:totalGrowth,glLive:live(gl.gl[0]),budgets:{late24Cycles:512*1024,postWarmup:2*1024*1024},limitations:'Headless Chromium/SwiftShader; bounded scenario/resource budgets, not native RSS/GPU bytes, phone FPS or heat.'};
writeFileSync(dir+'/verified-soak.json',JSON.stringify(summary,null,2));console.log('Soak resource checks PASS',summary);
