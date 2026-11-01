// Run after performance-audit.mjs --prepare-only. The normal app remains unchanged.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const output='.test-output/large-board-soak';mkdirSync(output,{recursive:true});
const raw=readFileSync('src/content/levels.ts','utf8'),levels=JSON.parse(raw.slice(raw.indexOf('= ')+2).trim().replace(/;$/,''));
const l=levels.find(x=>x.id==='shapes-29'),key='road-lines.save.v1',prefix=l.witness.slice(0,20);
const report={provenance:JSON.parse(readFileSync('.test-output/performance-audit/provenance.json','utf8')),cycles:0,memory:[],errors:[]};
const url='http://127.0.0.1:4213';let server,browser;
try{
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','.test-output/performance-audit/probe-src','--host','127.0.0.1','--port','4213','--strictPort'],{stdio:'ignore'});
 for(let i=0;;i++){try{if((await fetch(url)).ok)break;}catch{}if(i>80)throw Error('preview');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 await context.addInitScript(({l,key,prefix,completed})=>{
  localStorage.setItem(key,JSON.stringify({version:3,levelId:l.id,levelVersion:l.version,path:prefix,completed,coins:720,hints:3,themeId:'classic',ownedThemes:['classic','mint'],drafts:{},giftMilestones:1,giftNotice:null,lastOfferAt:30,offer:null,daily:{lastDate:null,pending:null,last:null}}));
  localStorage.setItem('road-lines.feedback.v1',JSON.stringify({sound:true,vibration:false}));
 },{l,key,prefix,completed:[...levels.slice(0,3),...levels.slice(60,88)].map(x=>x.id)});
 const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').click();await p.waitForTimeout(1200);
 const cdp=await context.newCDPSession(p);
 async function sample(label){await p.locator('[data-action=pause]').click();await p.waitForTimeout(350);await cdp.send('HeapProfiler.collectGarbage');const usage=await cdp.send('Runtime.getHeapUsage'),dom=await cdp.send('Memory.getDOMCounters'),state=await p.evaluate(()=>({path:__perf.state().path,loop:__perf.game.loop.running,objects:__perf.scene.children.list.length,labels:__perf.scene.checkpointLabels.length,textures:Object.keys(__perf.game.textures.list).length,canvases:document.querySelectorAll('canvas').length,particles:__perf.motion.particles.length,timers:__perf.motion.timers.size,animations:__perf.motion.animations.size,voices:__perf.feedback.voices.size}));report.memory.push({label,usage,dom,state});await p.locator('[data-action=resume]').click();}
 async function drag(path){const points=await p.evaluate(()=>{const s=__perf.scene,a=s.currentLayout,b=document.querySelector('#board').getBoundingClientRect();return Object.fromEntries(s.level.cells.map(c=>[c,{x:b.x+a.x+(c%s.level.width-a.minX)*(a.cell+a.gap)+a.cell/2,y:b.y+a.y+(Math.floor(c/s.level.width)-a.minY)*(a.cell+a.gap)+a.cell/2}]));});let q=points[path[0]];await p.mouse.move(q.x,q.y);await p.mouse.down();for(const c of path.slice(1)){q=points[c];await p.mouse.move(q.x,q.y);}await p.mouse.up();}
 for(let i=0;i<66;i++){
  await drag(l.witness.slice(10,20).reverse());await drag(l.witness.slice(10,20));
  assert.deepEqual(await p.evaluate(()=>__perf.state().path),prefix);
  if(i%6===5){await p.locator('[data-action=pause]').click();await p.setViewportSize({width:320,height:568});await p.waitForTimeout(50);await p.setViewportSize({width:390,height:844});await p.waitForTimeout(50);await p.locator('[data-action=home]:visible').click();await p.locator('[data-action=continue]').click();}
  await p.waitForTimeout(440);
  if([5,25,45,65].includes(i)){await sample(i===5?'warmup 6':`cycles ${i+1}`);console.log('Large-board sample',i+1);}
  report.cycles=i+1;
 }
 const first=report.memory[0],last=report.memory.at(-1);
 for(const row of report.memory){assert.equal(row.dom.documents,first.dom.documents);assert.equal(row.dom.jsEventListeners,first.dom.jsEventListeners);assert(row.dom.nodes<=first.dom.nodes+4,'DOM growth exceeded small initial warmup budget');assert.deepEqual(row.state,first.state);assert.equal(row.state.loop,false);assert.equal(row.state.particles,0);assert.equal(row.state.voices,0);assert.equal(row.state.timers,0);assert.equal(row.state.animations,0);}
 assert.deepEqual(report.memory.at(-1).dom,report.memory.at(-2).dom,'Late DOM counters must stop growing');
 report.late20CycleHeapGrowth=last.usage.usedSize-report.memory.at(-2).usage.usedSize;
 assert(report.late20CycleHeapGrowth<512*1024,'Retained JS exceeded late 20-cycle budget');
 const saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.deepEqual(saved.path,prefix);assert.equal(saved.coins,720);assert.equal(saved.hints,3);
 assert.deepEqual(report.errors,[]);console.log('Large-board soak PASS:',report.cycles,'drag pairs, 22 paused resizes, 11 menu round trips');await context.close();
}catch(e){report.errors.push(e.stack);process.exitCode=1;}finally{writeFileSync(output+'/results.json',JSON.stringify(report,null,2));await browser?.close();server?.kill('SIGTERM');}
