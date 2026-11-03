// Private development probe: exercises the real Feedback and WebAudio nodes, never bundled with the game.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const bank=JSON.parse(readFileSync('src/presentation/sound-bank.ts','utf8').match(/soundBank = (\{[\s\S]*\}) as const/)[1]);
const levels=JSON.parse(readFileSync('src/content/levels.ts','utf8').split('= ')[1].trim().replace(/;$/,''));
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
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{
  const Base=AudioContext;window.audit={created:0,closed:0,live:0,peak:0,starts:[],stops:[],contexts:[],resumes:[]};
  window.AudioContext=class extends Base {
   constructor(...a){super(...a);audit.created++;audit.contexts.push(this);} close(){audit.closed++;return super.close();}
   resume(){const r={at:performance.now(),end:null};audit.resumes.push(r);return super.resume().then(v=>{r.end=performance.now();return v;});}
   createBufferSource(){const s=super.createBufferSource(),start=s.start.bind(s),stop=s.stop.bind(s);let started=false;
    s.start=(...a)=>{started=true;audit.live++;audit.peak=Math.max(audit.peak,audit.live);audit.starts.push({at:performance.now(),rate:s.playbackRate.value,offset:a[1],duration:s.buffer.duration});return start(...a);};
    s.stop=(...a)=>{audit.stops.push(a[0]??0);return stop(...a);};
    s.addEventListener('ended',()=>{if(started)audit.live--;},{once:true});return s;
   }
  };
 });
 if(process.argv.includes('--slow'))await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.goto('http://127.0.0.1:4253/.test-output/audio/probe.html');await page.locator('#prime').click();
 await page.waitForFunction(()=>feedback.buffer&&feedback.context.state==='running');
 const cold=await page.evaluate(()=>{
  const buffer=feedback.buffer;feedback.buffer=undefined;feedback.setUIAllowed(true);
  const at=performance.now();feedback.playButton();feedback.buffer=buffer;
  return{voice:audit.starts.at(-1),latency:performance.now()-at};
 });
 assert(Math.abs(cold.voice.duration-.065)<.0001);assert(cold.latency<50);
 await page.waitForTimeout(150);await page.evaluate(()=>{feedback.setUIAllowed(false);audit.starts=[];audit.stops=[];audit.peak=0;});
 report.checks.push('cold button starts immediately without the large decoded sprite or a callback queue');
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
 report.checks.push('one context, clean disposal');report.route={...route,contexts:undefined};
 // Actual application buttons: accepted activation once, including under pause/shop blockers.
 await page.evaluate(l=>{
  localStorage.setItem('road-lines.feedback.v1',JSON.stringify({sound:true,vibration:false}));
  localStorage.setItem('road-lines.save.v1',JSON.stringify({version:4,levelId:l.id,levelVersion:l.version,path:[l.start],completed:[],coins:0,hints:0,themeId:'classic',ownedThemes:['classic','mint'],drafts:{},giftMilestones:0,giftNotice:null,lastOfferAt:0,offer:null,daily:{lastDate:null,pending:null,last:null}}));
 },levels[2]);
 await page.goto('http://127.0.0.1:4253/');await page.locator('#app[data-ready=true]').waitFor();
 const offsets=bank.button.map(x=>x[0]);
 const count=()=>page.evaluate(offsets=>audit.starts.filter(x=>offsets.includes(x.offset)||Math.abs(x.duration-.065)<.0001).length,offsets);
 async function pop(selector,keyboard=false){
  const before=await count();const button=page.locator(selector);if(keyboard){await button.focus();await page.keyboard.press('Enter');}else await button.tap();
  try {await page.waitForFunction(({offsets,before})=>audit.starts.filter(x=>offsets.includes(x.offset)||Math.abs(x.duration-.065)<.0001).length>before,{offsets,before},{timeout:2000});}
  catch(e){report.missingPop={selector,details:await page.evaluate(()=>({resumes:audit.resumes,contexts:audit.contexts.map(c=>c.state),starts:audit.starts,blocked:document.querySelector('#app').dataset.blocked,hidden:document.hidden}))};throw e;}
  await page.waitForTimeout(130);assert.equal(await count(),before+1,selector+' emits once');
 }
 await pop('[data-action=continue]');await pop('[data-action=pause]');
 await page.waitForFunction(()=>audit.contexts.every(c=>c.state==='suspended'));assert.equal(await page.locator('#app').getAttribute('data-blocked'),'true');
 await pop('[data-action=language][data-language=en]');
 const muted=await count();await page.locator('[data-action=sound]').tap();await page.waitForTimeout(150);assert.equal(await count(),muted);
 await pop('[data-action=sound]');await pop('[data-action=resume]',true);
 report.checks.push('real touch/keyboard menu and pause buttons emit once; mute respected and enabling sound is audible');
 await pop('[data-action=hint]');await page.locator('.hint-overlay:visible').waitFor();
 const disabled=await count();await page.locator('[data-action=buy-hints][data-count="1"]').evaluate(b=>b.click());await page.waitForTimeout(150);assert.equal(await count(),disabled);
 await pop('[data-action=close-hint-shop]');
 report.checks.push('shop close is audible; disabled purchase is silent');
 const beforeBackground=await count();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));document.querySelector('[data-action=pause]').click();});
 await page.waitForTimeout(200);assert.equal(await count(),beforeBackground);
 report.checks.push('background suppresses UI sounds too');assert.deepEqual(report.errors,[]);
 writeFileSync(out+'/browser-results.json',JSON.stringify(report,null,2));console.log('Audio smoke PASS',report.checks);
} catch(e) {report.errors.push(String(e));writeFileSync(out+'/browser-results.json',JSON.stringify(report,null,2));throw e;} finally {await browser?.close();server.kill();}
