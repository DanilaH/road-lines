import {chromium} from '@playwright/test';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readdirSync,statSync} from 'node:fs';
const root=process.cwd(),out=resolve(root,'.test-output/performance-audit');mkdirSync(out,{recursive:true});
const mode=process.argv.includes('--supplement')?'supplement':process.argv.includes('--drag-repeats')?'drag-repeats':'main';
const sourceCommit=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
const sourceHash=createHash('sha256');
for(const file of readdirSync('src',{recursive:true}).filter(f=>statSync('src/'+f).isFile()).sort()){const path='src/'+file;sourceHash.update(path+'\0').update(readFileSync(path)).update('\0');}
const sourceSha256=sourceHash.digest('hex');
// Diagnostic build only. Never adds inspection globals to src/ or the normal release build.
const probe=resolve(out,'probe-src');mkdirSync(probe,{recursive:true});cpSync(resolve(root,'src'),resolve(probe,'src'),{recursive:true});
for(const f of ['index.html','package.json','vite.config.ts','tsconfig.json'])cpSync(resolve(root,f),resolve(probe,f));
for(const f of ['node_modules','vendor','public'])if(!existsSync(resolve(probe,f)))symlinkSync(resolve(root,f),resolve(probe,f),'dir');
const mainFile=resolve(probe,'src/main.ts'),original=readFileSync(mainFile,'utf8'),needle='  const pagehide = (event: PageTransitionEvent)';
if(!original.includes(needle))throw Error('Probe insertion point changed: review the harness before running.');
writeFileSync(mainFile,original.replace(needle,'  (window as any).__perf = { scene, game, motion, screens, feedback, hints, wheelView, store, activity, dispose, state: () => ({screen, paused, result, path: [...path], disposed}) };\n'+needle));
if(spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build',probe],{stdio:'inherit'}).status!==0)process.exit(1);
writeFileSync(resolve(out,'provenance.json'),JSON.stringify({sourceCommit,sourceSha256,mode,probe:'Isolated production source copy; sole source change exposes existing objects. Instrumentation/ablation added at runtime. Normal release globals untouched.'},null,2));
if(process.argv.includes('--prepare-only'))process.exit(0);
const raw=readFileSync('src/content/levels.ts','utf8'),levels=JSON.parse(raw.slice(raw.indexOf('= ')+2).trim().replace(/;$/,''));
const key='road-lines.save.v1',report={source:sourceCommit,sourceSha256,environment:{headless:true,viewport:[390,844],dpr:2,method:'Private production source copy with object exposure only; wrappers add overhead; ablations are diagnostic, not usable game variants.'},render:[],effects:[],memory:[],resources:[],save:[],errors:[]};
const flush=()=>writeFileSync(resolve(out,mode==='main'?'results.json':mode+'.json'),JSON.stringify(report,null,2));
const seed=(l,{path=[l.start],rich=false}={})=>({version:3,levelId:l.id,levelVersion:l.version,path,completed:rich?levels.map(l=>l.id):[],coins:rich?2200:0,hints:3,themeId:'classic',ownedThemes:['classic','mint'],drafts:rich?Object.fromEntries(levels.map(x=>[x.id,{version:x.version,path:x.witness}])):{},giftMilestones:rich?4:0,giftNotice:null,lastOfferAt:rich?70:0,offer:null,daily:{lastDate:null,pending:null,last:null}});
let browser;const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','.test-output/performance-audit/probe-src','--host','127.0.0.1','--port','4202','--strictPort'],{stdio:'ignore'}),url='http://127.0.0.1:4202';
async function open(l,options={}){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,reducedMotion:options.reduced?'reduce':'no-preference'});
 await context.addInitScript(({data,key,sound,gpuTrace})=>{
  localStorage.setItem(key,JSON.stringify(data));localStorage.setItem('road-lines.feedback.v1',JSON.stringify({sound:!!sound,vibration:false}));
  const r=window.__resources={raf:new Set(),timeouts:new Set(),intervals:new Set(),workers:new Set(),audioCreated:0,audioClosed:0,voices:0,peakVoices:0,writes:0};
  if(gpuTrace){
  const gpu=window.__gpu={};const seen=new WeakSet(),deleted=new WeakSet();
  for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(C)for(const kind of ['Texture','Buffer','Framebuffer','Renderbuffer','Shader','Program']){
   const proto=C.prototype,create=proto['create'+kind],remove=proto['delete'+kind];if(!create||!remove)continue;
   proto['create'+kind]=function(...args){const value=create.apply(this,args);if(value&&!seen.has(value)){seen.add(value);const q=gpu[kind]??(gpu[kind]={created:0,deleted:0,refs:[]});q.created++;q.refs.push(new WeakRef(value));}return value;};
   proto['delete'+kind]=function(value,...args){if(value&&seen.has(value)&&!deleted.has(value)){deleted.add(value);gpu[kind].deleted++;}return remove.call(this,value,...args);};
  }
  window.__gpuRead=()=>Object.fromEntries(Object.entries(gpu).map(([k,q])=>[k,{created:q.created,deleted:q.deleted,live:q.refs.reduce((n,r)=>{const o=r.deref();return n+Number(!!o&&!deleted.has(o));},0)}]));
  }
  const raf=requestAnimationFrame.bind(window),caf=cancelAnimationFrame.bind(window);window.requestAnimationFrame=f=>{let id=raf(t=>{r.raf.delete(id);f(t);});r.raf.add(id);return id;};window.cancelAnimationFrame=id=>{r.raf.delete(id);caf(id);};
  const st=setTimeout.bind(window),ct=clearTimeout.bind(window),si=setInterval.bind(window),ci=clearInterval.bind(window);
  window.setTimeout=(f,t,...a)=>{let id=st((...b)=>{r.timeouts.delete(id);typeof f==='function'?f(...b):window.eval(f);},t,...a);r.timeouts.add(id);return id;};window.clearTimeout=id=>{r.timeouts.delete(id);ct(id);};window.setInterval=(f,t,...a)=>{const id=si(f,t,...a);r.intervals.add(id);return id;};window.clearInterval=id=>{r.intervals.delete(id);ci(id);};
  const WorkerBase=window.Worker;window.Worker=class extends WorkerBase{constructor(...a){super(...a);r.workers.add(this);}terminate(){r.workers.delete(this);return super.terminate();}};
  const AudioBase=window.AudioContext;window.AudioContext=class extends AudioBase{constructor(...a){super(...a);r.audioCreated++;}close(){r.audioClosed++;return super.close();}createOscillator(){const n=super.createOscillator();r.voices++;r.peakVoices=Math.max(r.voices,r.peakVoices);n.addEventListener('ended',()=>r.voices--,{once:true});return n;}};
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)r.writes++;return set.call(this,k,v);};
 },{data:seed(l,options),key,sound:options.sound,gpuTrace:mode==='supplement'});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').click();await p.waitForTimeout(1400);
 await p.evaluate(()=>{
  const a=window.__perf;const s=()=>({rebuild:[],graphics:[],graphicsStep:[],confetti:[],renderer:[],pointer:[],fillPaths:0,strokePaths:0,maxParticles:0,maxSparks:0,maxCommands:0});a.samples=s();a.reset=()=>a.samples=s();
  const wrap=(o,k,field)=>{const f=o[k];if(typeof f!=='function')return;o[k]=function(...args){const at=performance.now();try{return f.apply(this,args);}finally{if(field==='rebuild'){a.samples.maxSparks=Math.max(a.samples.maxSparks,a.scene.sparks.length);a.samples.maxCommands=Math.max(a.samples.maxCommands,a.scene.drawing.commandBuffer.length);}const d=a.samples[field];if(d?.length<10000)d.push(performance.now()-at);}};};
  wrap(a.scene,'renderBoard','rebuild');wrap(a.scene.drawing,'renderWebGL','graphics');wrap(a.scene.drawing,'renderWebGLStep','graphicsStep');wrap(a.game.renderer,'render','renderer');wrap(a.motion,'draw','confetti');
  for(const [node,field] of [['FillPath','fillPaths'],['StrokePath','strokePaths']]){const n=a.scene.drawing.defaultRenderNodes[node],f=n.run;n.run=function(...args){a.samples[field]++;return f.apply(this,args);};}
  const u=a.scene.update;a.scene.update=function(...args){const r=u.apply(this,args);a.samples.maxSparks=Math.max(a.samples.maxSparks,this.sparks.length);a.samples.maxCommands=Math.max(a.samples.maxCommands,this.drawing.commandBuffer.length);return r;};
  const burst=a.motion.burst;a.motion.burst=function(...args){const r=burst.apply(this,args);a.samples.maxParticles=Math.max(a.samples.maxParticles,this.particles.length);return r;};
  let start=0;window.addEventListener('pointermove',()=>start=performance.now(),true);window.addEventListener('pointermove',()=>{if(a.samples.pointer.length<10000)a.samples.pointer.push(performance.now()-start);});
  a.read=()=>({state:a.state(),loop:a.game.loop.running,pendingDestroy:a.game.pendingDestroy,renderType:a.game.renderer?.type,commands:a.scene.drawing?.commandBuffer?.length,labels:a.scene.checkpointLabels.length,objects:a.scene.children?.list?.length,textures:a.game.textures?.list?Object.keys(a.game.textures.list).length:0,canvases:document.querySelectorAll('canvas').length,ghosts:document.querySelectorAll('[data-transition-ghost]').length,coins:document.querySelectorAll('.flying-coin').length,animations:document.getAnimations().map(x=>({type:x.constructor.name,state:x.playState,name:x.animationName,target:x.effect?.target?.tagName,hidden:x.effect?.target?getComputedStyle(x.effect.target).visibility:undefined})),queues:{timers:a.motion.timers.size,animations:a.motion.animations.size,coins:a.motion.coins.length,particles:a.motion.particles.length,sparks:a.scene.sparks.length,wheelSparks:a.wheelView.sparks.length},live:{raf:__resources.raf.size,timeouts:__resources.timeouts.size,intervals:__resources.intervals.size,workers:__resources.workers.size,audioCreated:__resources.audioCreated,audioClosed:__resources.audioClosed,voices:__resources.voices,peakVoices:__resources.peakVoices,writes:__resources.writes}});
 });
 return {p,context};
}
const stats=v=>{const a=[...v].sort((x,y)=>x-y);return {n:a.length,median:a[Math.floor(a.length*.5)]??0,p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]??0,total:a.reduce((a,b)=>a+b,0),max:a.at(-1)??0};};
async function sample(p,label,ms=1500,action){await p.evaluate(()=>__perf.reset());const start=Date.now();if(action)await action();else await p.waitForTimeout(ms);const {data,state}=await p.evaluate(()=>({data:__perf.samples,state:__perf.read()}));const metrics={};for(const [k,v]of Object.entries(data))metrics[k]=Array.isArray(v)?stats(v):v;return {label,elapsedMs:Date.now()-start,metrics,state};}
async function centers(p,l){const b=await p.locator('#board').boundingBox(),xs=l.cells.map(c=>c%l.width),ys=l.cells.map(c=>Math.floor(c/l.width)),nx=Math.max(...xs)-Math.min(...xs)+1,ny=Math.max(...ys)-Math.min(...ys)+1,z=Math.min(56*Math.min(b.width/390,1.5),(b.width-40)/(nx+(nx-1)/7),(b.height-64)/(ny+(ny-1)/7));return Object.fromEntries(l.cells.map(c=>[c,{x:b.x+(b.width-(nx-1)*z*8/7-z)/2+(c%l.width-Math.min(...xs))*z*8/7+z/2,y:b.y+(b.height-(ny-1)*z*8/7-z)/2+(Math.floor(c/l.width)-Math.min(...ys))*z*8/7+z/2}]));}
async function drag(p,points,path){let q=points[path[0]];await p.mouse.move(q.x,q.y);await p.mouse.down();for(const c of path.slice(1)){q=points[c];await p.mouse.move(q.x,q.y);}await p.mouse.up();}
async function heap(p,cdp,label){await p.evaluate(()=>__perf.reset());await p.waitForTimeout(350);await cdp.send('HeapProfiler.collectGarbage');const [usage,dom,state]=await Promise.all([cdp.send('Runtime.getHeapUsage'),cdp.send('Memory.getDOMCounters'),p.evaluate(()=>__perf.read())]);const row={label,usage,dom,state};report.memory.push(row);flush();return row;}
try{
 for(let i=0;;i++){try{if((await fetch(url)).ok)break;}catch{}if(i>80)throw Error('preview');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 if(mode==='supplement'){
 const l=levels.find(l=>l.id==='shapes-29'),{p,context}=await open(l,{path:l.witness.slice(0,20),rich:true});const cdp=await context.newCDPSession(p);
 report.sampling=[];
 for(const hidden of [false,true]){
  await p.evaluate(hidden=>{__perf.scene.drawing.visible=!hidden;__perf.reset();},hidden);
  await cdp.send('HeapProfiler.startSampling',{samplingInterval:16384,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});const started=Date.now();await p.waitForTimeout(2400);const profile=(await cdp.send('HeapProfiler.stopSampling')).profile;
  let bytes=0;const names=new Map();function walk(n){bytes+=n.selfSize||0;const k=n.callFrame.functionName;names.set(k,(names.get(k)||0)+(n.selfSize||0));for(const c of n.children||[])walk(c);}walk(profile.head);
  writeFileSync(resolve(out,hidden?'alloc-hidden.json':'alloc-baseline.json'),JSON.stringify(profile));
  report.sampling.push({hidden,elapsedMs:Date.now()-started,sampledBytes:bytes,topSelfBytes:[...names].sort((a,b)=>b[1]-a[1]).slice(0,10),counters:await p.evaluate(()=>({graphicsFrames:__perf.samples.graphicsStep.length,fillPaths:__perf.samples.fillPaths}))});
 }
 await p.evaluate(()=>__perf.scene.drawing.visible=true);await p.locator('[data-action=pause]').click();await cdp.send('HeapProfiler.collectGarbage');report.gl=[{label:'warm',data:await p.evaluate(()=>__gpuRead())}];
 for(let batch=1;batch<=3;batch++){
  for(let i=0;i<10;i++){await p.setViewportSize(i%2?{width:390,height:844}:{width:320,height:568});await p.waitForTimeout(100);}
  await cdp.send('HeapProfiler.collectGarbage');await p.waitForTimeout(50);report.gl.push({label:'resizes '+batch*10,data:await p.evaluate(()=>__gpuRead())});
 }
 const writes=await p.evaluate(()=>__resources.writes);for(let i=0;i<8;i++){await p.locator('[data-action=resume]').click();await p.locator('[data-action=pause]').click();}report.identicalPauseWrites=await p.evaluate(writes=>__resources.writes-writes,writes);
 await context.close();

 }else if(mode==='drag-repeats'){
const l=levels.find(l=>l.id==='shapes-29'),{p,context}=await open(l);const points=await centers(p,l),path=l.witness.slice(0,11);
 await p.evaluate(()=>__perf.originalReact=__perf.scene.react);
 for(const [i,disabled]of [false,true,false,true,true,false].entries()){
  await p.evaluate(disabled=>{const a=__perf;a.scene.react=function(...args){const r=a.originalReact.apply(this,args);if(disabled)this.sparks=[];return r;};},disabled);
  const result=await sample(p,(disabled?'no-sparks-':'baseline-')+i,0,async()=>{await drag(p,points,path);await drag(p,points,[...path].reverse());});result.warmup=i<2;report.render.push(result);await p.waitForTimeout(1400);
 }
 await context.close();

 }else{
 for(const [id,len]of [['intro-01',1],['shapes-29',1],['shapes-29',20]]){
  const l=levels.find(x=>x.id===id),{p,context}=await open(l,{path:l.witness.slice(0,len)});const cdp=await context.newCDPSession(p);const gpu=await p.evaluate(()=>{const gl=__perf.game.renderer.gl,ex=gl.getExtension('WEBGL_debug_renderer_info');return ex?gl.getParameter(ex.UNMASKED_RENDERER_WEBGL):'unavailable';});report.environment.gpu=gpu;
  report.render.push(await sample(p,id+'-'+len+'-idle'));
  await p.evaluate(()=>__perf.scene.drawing.visible=false);report.render.push(await sample(p,id+'-'+len+'-hide-graphics'));await p.evaluate(()=>__perf.scene.drawing.visible=true);
  if(len===20){await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});report.render.push(await sample(p,id+'-'+len+'-cpu4'));await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});}
  await context.close();flush();console.log('Render:',id,len);
 }
 {
  const l=levels.find(l=>l.id==='shapes-29'),{p,context}=await open(l);const points=await centers(p,l),path=l.witness.slice(0,11);
  for(const noSparks of [false,true]){
   await p.evaluate(disable=>{const a=__perf;if(!a.originalReact)a.originalReact=a.scene.react;a.scene.react=function(...args){const r=a.originalReact.apply(this,args);if(disable)this.sparks=[];return r;};},noSparks);
   report.render.push(await sample(p,noSparks?'drag-without-sparks':'drag-baseline',0,async()=>{await drag(p,points,path);await drag(p,points,[...path].reverse());}));await p.waitForTimeout(1400);
  }
  await context.close();flush();console.log('Drag ablation complete');
 }
 for(const noConfetti of [false,true]){
  const l=levels[0],{p,context}=await open(l,{path:[0,1]});if(noConfetti)await p.evaluate(()=>__perf.motion.burst=()=>{});
  report.effects.push(await sample(p,noConfetti?'win-without-confetti':'win-baseline',0,async()=>{await p.locator('#board').focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(4500);}));
  report.effects.push(await sample(p,noConfetti?'result-without-confetti':'result-settled',1200));
  await p.locator('[data-action=home]:visible').click();await p.waitForTimeout(350);report.resources.push({label:noConfetti?'home-after-no-confetti':'home-after-result',state:await p.evaluate(()=>__perf.read())});
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});report.resources.push({label:'background-after-result',state:await p.evaluate(()=>__perf.read())});
  await context.close();flush();console.log('Win ablation:',noConfetti);
 }
 for(const rich of [false,true]){
  const l=levels[2],{p,context}=await open(l,{path:[0,1],rich});await p.locator('[data-action=pause]').click();const cdp=await context.newCDPSession(p);
  for(const rate of [1,4]){await cdp.send('Emulation.setCPUThrottlingRate',{rate});const result=await p.evaluate(()=>{const times=[];for(let i=0;i<60;i++){const at=performance.now();__perf.store.path(__perf.scene.level,[0,1]);times.push(performance.now()-at);}return {times,bytes:localStorage.getItem('road-lines.save.v1').length};});report.save.push({rich,cpuThrottle:rate,bytes:result.bytes,write:stats(result.times)});}
  await context.close();flush();console.log('Save benchmark:',rich);
 }
 {
  const l=levels[0],{p,context}=await open(l,{sound:true});const cdp=await context.newCDPSession(p);
  async function cycle(){if(await p.locator('.result-heading').isVisible())await p.locator('[data-action=home]:visible').click();if(await p.locator('#app').getAttribute('data-screen')==='home'){await p.locator('[data-action=sets]:visible').click();await p.locator('[data-action=open-set][data-set=intro]').click();await p.locator('[data-action=choose-level][data-level=intro-01]').click();}await p.locator('#board').focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');await p.waitForTimeout(800);await p.locator('[data-action=home]:visible').click();await p.waitForTimeout(200);}
  for(let i=0;i<6;i++)await cycle();await heap(p,cdp,'UI warmup 6');
  for(let batch=1;batch<=(process.argv.includes('--long-soak')?8:4);batch++){for(let i=0;i<(process.argv.includes('--long-soak')?12:8);i++)await cycle();await heap(p,cdp,'UI cycles '+(6+batch*(process.argv.includes('--long-soak')?12:8)));console.log('UI memory:',6+batch*(process.argv.includes('--long-soak')?12:8));}
  await p.locator('[data-action=continue]').click();await p.waitForTimeout(350);
  for(let i=0;i<20;i++){await p.evaluate(()=>__perf.motion.start(20,1000,1,()=>{}));await p.waitForTimeout(i%4===0?1550:420);if(i%2===0)await p.evaluate(()=>__perf.motion.collect());await p.evaluate(()=>__perf.motion.stop());}
  await p.locator('[data-action=home]:visible').click();await heap(p,cdp,'after 20 presentation stress cycles');
  const worker=await p.evaluate(async()=>{let found=0,cancelled=0;for(let i=0;i<20;i++){const promise=__perf.hints.request(__perf.scene.level,[0]);if(i%2)__perf.hints.cancel();const r=await promise;if(r?.kind==='FOUND')found++;if(r===null)cancelled++;}return {found,cancelled,workers:__resources.workers.size};});report.resources.push({label:'worker stress',...worker});flush();await context.close();
 }
 for(const sleeping of [false,true]){
  const {p,context}=await open(levels[0],{sound:true});if(sleeping){await p.locator('[data-action=pause]').click();await p.locator('[data-action=home]:visible').click();}const before=await p.evaluate(()=>__perf.read());await p.evaluate(()=>__perf.dispose());await p.waitForTimeout(500);const after=await p.evaluate(()=>__perf.read());
  let afterWake=null;if(after.pendingDestroy){await p.evaluate(()=>__perf.game.loop.wake());await p.waitForTimeout(200);afterWake=await p.evaluate(()=>({pendingDestroy:__perf.game.pendingDestroy,canvases:document.querySelectorAll('canvas').length,glAlive:!!__perf.game.renderer?.gl,live:{raf:__resources.raf.size,timeouts:__resources.timeouts.size,intervals:__resources.intervals.size}}));}
  report.resources.push({label:sleeping?'dispose-while-sleeping':'dispose-while-running',before,after,afterWake});flush();await context.close();console.log('Dispose:',sleeping);
 }

 }
}catch(e){report.errors.push(e.stack);process.exitCode=1;}finally{flush();await browser?.close();server.kill('SIGTERM');console.log('Audit saved',out);}
