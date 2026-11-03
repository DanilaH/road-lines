// Private development probe: exercises the real Feedback and WebAudio nodes, never bundled with the game.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='.test-output/audio';mkdirSync(out,{recursive:true});
writeFileSync(out+'/probe.html',`<button id="prime">Sound</button><script type="module">
import { Feedback } from '/src/presentation/feedback.ts';
window.feedback=new Feedback({getItem:()=>JSON.stringify({sound:true,vibration:false}),setItem:()=>{}});
document.querySelector('button').onclick=()=>feedback.prime();
</script>`);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4253','--strictPort'],{stdio:'ignore'});
let browser;const report={checks:[],errors:[]};
try {
 for(let i=0;;i++){try{if((await fetch('http://127.0.0.1:4253/.test-output/audio/probe.html')).ok)break;}catch{}if(i>80)throw Error('server');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{
  const Base=AudioContext;window.audit={created:0,closed:0,live:0,peak:0,starts:[],stops:[]};
  window.AudioContext=class extends Base {
   constructor(...a){super(...a);audit.created++;} close(){audit.closed++;return super.close();}
   createBufferSource(){const s=super.createBufferSource(),start=s.start.bind(s),stop=s.stop.bind(s);let started=false;
    s.start=(...a)=>{started=true;audit.live++;audit.peak=Math.max(audit.peak,audit.live);audit.starts.push({at:performance.now(),rate:s.playbackRate.value,offset:a[1]});return start(...a);};
    s.stop=(...a)=>{audit.stops.push(a[0]??0);return stop(...a);};
    s.addEventListener('ended',()=>{if(started)audit.live--;},{once:true});return s;
   }
  };
 });
 await page.goto('http://127.0.0.1:4253/.test-output/audio/probe.html');await page.locator('#prime').click();
 await page.waitForFunction(()=>feedback.buffer&&feedback.context.state==='running');
 const route=await page.evaluate(async()=>{
  feedback.setLevel('intro-01');const accepted=[];
  for(let i=0;i<30;i++){
   const n=audit.starts.length,at=performance.now();feedback.play(i%5===0?'undo':'cell',i/30);
   if(audit.starts.length>n)accepted.push(audit.starts.at(-1).at-at);
   await new Promise(r=>setTimeout(r,20));
  }
  await new Promise(r=>setTimeout(r,200));return{...audit,accepted};
 });
 assert(route.starts.length>=6&&route.starts.length<=12);assert(route.peak<=2);assert.equal(route.live,0);
 assert(route.accepted.every(delay=>delay<50));assert(route.stops.length>0);
 for(const s of route.starts){const n=12*Math.log2(s.rate);assert([0,2,4,7].some(x=>Math.abs(x-n)<1e-6));}
 report.checks.push('rapid route/undo: shared density limit, immediate starts, at most two crossfading voices, no queued replay');
 await page.evaluate(()=>{feedback.play('win');feedback.play('star');feedback.play('coin');feedback.setBlocked(true);});
 await page.waitForTimeout(100);const stopped=await page.evaluate(()=>({...audit,state:feedback.context.state}));assert.equal(await page.evaluate(()=>feedback.voices.size),0);assert(stopped.stops.length>=route.stops.length+3);assert.equal(stopped.state,'suspended');
 await page.evaluate(()=>feedback.play('gift'));await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>audit.starts.length),stopped.starts.length);
 await page.evaluate(()=>feedback.setBlocked(false));await page.locator('#prime').click();await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>audit.live),0);assert.equal(await page.evaluate(()=>audit.starts.length),stopped.starts.length);
 report.checks.push('background stops all sources and suspends output; resume drains ended events without replay');
 await page.evaluate(()=>{feedback.setBlocked(false);feedback.dispose();});await page.waitForTimeout(100);
 const disposed=await page.evaluate(()=>audit);assert.equal(disposed.created,1);assert.equal(disposed.closed,1);assert.equal(disposed.live,0);
 report.checks.push('one context, clean disposal');report.route=route;assert.deepEqual(report.errors,[]);
 writeFileSync(out+'/browser-results.json',JSON.stringify(report,null,2));console.log('Audio smoke PASS',report.checks);
} catch(e) {report.errors.push(String(e));writeFileSync(out+'/browser-results.json',JSON.stringify(report,null,2));throw e;} finally {await browser?.close();server.kill();}
