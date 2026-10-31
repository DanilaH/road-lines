// Run after performance-audit.mjs prepares its isolated diagnostic production build.
// The optional --before directory holds an immutable diagnostic build from the audit baseline.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const output='.test-output/performance-regression';mkdirSync(output,{recursive:true});
const raw=readFileSync('src/content/levels.ts','utf8'), levels=JSON.parse(raw.slice(raw.indexOf('= ')+2).trim().replace(/;$/,''));
const key='road-lines.save.v1',report={errors:[],checks:[],runs:[]};
const args=process.argv, before=args.includes('--before')?args[args.indexOf('--before')+1]:null;
const builds=[...(before?[['before',before]]:[]),['after','.test-output/performance-audit/probe-src']];
const stats=v=>{v.sort((a,b)=>a-b);return {n:v.length,median:v[Math.floor(v.length*.5)]??0,p95:v[Math.floor(v.length*.95)]??0,total:v.reduce((a,b)=>a+b,0)};};
let browser,server;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [name,dir] of builds){
  server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',dir,'--host','127.0.0.1','--port','4208','--strictPort'],{stdio:'ignore'});
  const url='http://127.0.0.1:4208';for(let i=0;;i++){try{if((await fetch(url)).ok)break;}catch{}if(i>80)throw Error('preview');await new Promise(r=>setTimeout(r,100));}
  const l=levels.find(l=>l.id==='shapes-29');
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,recordVideo:{dir:output+'/video',size:{width:390,height:844}}});
  await context.addInitScript(({key,l})=>{localStorage.setItem(key,JSON.stringify({version:3,levelId:l.id,levelVersion:l.version,path:l.witness.slice(0,20),completed:[],coins:0,hints:3,themeId:'classic',ownedThemes:['classic','mint'],drafts:{},giftMilestones:0,giftNotice:null,lastOfferAt:0,offer:null,daily:{lastDate:null,pending:null,last:null}}));localStorage.setItem('road-lines.feedback.v1',JSON.stringify({sound:false,vibration:false}));},{key,l});
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').click();await p.waitForTimeout(1700);
  await p.evaluate(()=>{document.getAnimations().forEach(a=>a.pause());const a=__perf;a.measure={frames:0,fills:0,rebuilds:0,baseBakes:0,routeBakes:0,renderer:[]};a.game.events.on('postrender',()=>a.measure.frames++);const n=a.scene.drawing.defaultRenderNodes.FillPath,run=n.run;n.run=function(...v){a.measure.fills++;return run.apply(this,v);};const rb=a.scene.renderBoard;a.scene.renderBoard=function(...v){a.measure.rebuilds++;return rb.apply(this,v);};if(a.scene.bake){const bake=a.scene.bake;a.scene.bake=function(image,...v){a.measure[image===a.scene.baseImage?'baseBakes':'routeBakes']++;return bake.call(this,image,...v);};}const render=a.game.renderer.render;a.game.renderer.render=function(...v){const t=performance.now();try{return render.apply(this,v);}finally{a.measure.renderer.push(performance.now()-t);}};a.resetMeasure=()=>{a.measure={frames:0,fills:0,rebuilds:0,baseBakes:0,routeBakes:0,renderer:[]};};});
  const board=await p.locator('#board').boundingBox();await p.screenshot({path:output+'/'+name+'-board.png',clip:board});
  await p.evaluate(()=>__perf.resetMeasure());await p.waitForTimeout(1500);const idle=await p.evaluate(()=>({...__perf.measure,loop:__perf.game.loop.running}));
  if(name==='after'){assert.equal(idle.frames,0);assert.equal(idle.fills,0);assert.equal(idle.loop,false);report.checks.push('Idle has no Phaser frames or FillPath work');}
  const cdp=await context.newCDPSession(p);await cdp.send('HeapProfiler.startSampling',{samplingInterval:16384,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});await p.waitForTimeout(2400);const profile=(await cdp.send('HeapProfiler.stopSampling')).profile;let sampledBytes=0;const walk=n=>{sampledBytes+=n.selfSize??0;for(const c of n.children??[])walk(c);};walk(profile.head);
  const points=await p.evaluate(()=>{const a=__perf,s=a.scene,l=s.level,layout=s.currentLayout??{x:0};const host=document.querySelector('#board').getBoundingClientRect();if(s.currentLayout)return Object.fromEntries(l.cells.map(c=>[c,{x:host.x+layout.x+(c%l.width-layout.minX)*(layout.cell+layout.gap)+layout.cell/2,y:host.y+layout.y+(Math.floor(c/l.width)-layout.minY)*(layout.cell+layout.gap)+layout.cell/2}]));return null;});
  const centers=points??(()=>{const xs=l.cells.map(c=>c%l.width),ys=l.cells.map(c=>Math.floor(c/l.width)),nx=Math.max(...xs)-Math.min(...xs)+1,ny=Math.max(...ys)-Math.min(...ys)+1,z=Math.min(56*Math.min(board.width/390,1.5),(board.width-40)/(nx+(nx-1)/7),(board.height-64)/(ny+(ny-1)/7));return Object.fromEntries(l.cells.map(c=>[c,{x:board.x+(board.width-(nx-1)*z*8/7-z)/2+(c%l.width-Math.min(...xs))*z*8/7+z/2,y:board.y+(board.height-(ny-1)*z*8/7-z)/2+(Math.floor(c/l.width)-Math.min(...ys))*z*8/7+z/2}]));})();
  const drag=async path=>{let q=centers[path[0]];await p.mouse.move(q.x,q.y);await p.mouse.down();for(const c of path.slice(1)){q=centers[c];await p.mouse.move(q.x,q.y);}await p.mouse.up();};
  const drags=[];
  for(let i=0;i<4;i++){await p.evaluate(()=>__perf.resetMeasure());await drag(l.witness.slice(10,20).reverse());await drag(l.witness.slice(10,20));await p.waitForTimeout(450);const m=await p.evaluate(()=>__perf.measure);drags.push({...m,renderer:stats(m.renderer),warmup:i===0});assert.deepEqual(await p.evaluate(()=>__perf.state().path),l.witness.slice(0,20));}
  if(name==='after'){
   await p.evaluate(()=>__perf.resetMeasure());await p.evaluate(()=>__perf.scene.react(__perf.state().path.at(-1)));await p.waitForTimeout(500);const fx=await p.evaluate(()=>__perf.measure);assert.equal(fx.rebuilds,0);assert.equal(fx.baseBakes,0);assert.equal(fx.routeBakes,0);report.checks.push('Endpoint pulse/sparks render without rebuilding either cached texture');
   await drag(l.witness.slice(19));await p.locator('.result-heading').waitFor();await p.waitForTimeout(400);await p.screenshot({path:output+'/win-moving.png'});await p.waitForTimeout(4200);await p.screenshot({path:output+'/win-settled.png'});
   await p.locator('[data-action=home]:visible').click();await p.waitForTimeout(400);const running=await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.target?.closest?.('.game-content')).length);assert.equal(running,0);report.checks.push('Hidden result CSS animations are paused');
   await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(50);assert.equal(await p.locator('#app').getAttribute('data-background'),'true');assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);report.checks.push('Background pauses all CSS animation timelines');
   await p.evaluate(()=>__perf.dispose());await p.waitForTimeout(100);assert.equal(await p.locator('canvas').count(),0);assert.equal(await p.evaluate(()=>!!__perf.game.renderer?.gl),false);report.checks.push('Sleeping renderer disposal removes canvases and WebGL context');
   assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
   await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').click();await p.waitForTimeout(1000);
   const wasRunning=await p.evaluate(()=>new Promise(resolve=>{__perf.scene.react(__perf.state().path.at(-1));requestAnimationFrame(()=>{const running=__perf.game.loop.running;__perf.dispose();resolve(running);});}));
   assert.equal(wasRunning,true);await p.waitForTimeout(150);assert.equal(await p.locator('canvas').count(),0);assert.equal(await p.evaluate(()=>!!__perf.game.renderer?.gl),false);
   assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
   report.checks.push('Active renderer disposal also completes; disposed screen has no running CSS animations');

  }
  report.runs.push({name,idle,allocation:{sampledBytes,intervalMs:2400,method:'V8 allocation sampling including collected objects, not retained RAM'},drags});
  const video=p.video();await context.close();await video.saveAs(output+'/'+name+'-gameplay.webm');server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));server=null;
 }
 assert.deepEqual(report.errors,[]);console.log('Performance regression passed:',report.checks);
}catch(e){report.errors.push(e.stack);process.exitCode=1;}finally{writeFileSync(output+'/results.json',JSON.stringify(report,null,2));await browser?.close();server?.kill('SIGTERM');}
