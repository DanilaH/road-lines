// Production UI fault/restart scenarios. No application inspection globals.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const output='.test-output/persistence';mkdirSync(output,{recursive:true});
const raw=readFileSync('src/content/levels.ts','utf8'),levels=JSON.parse(raw.slice(raw.indexOf('= ')+2).trim().replace(/;$/,''));
const key='road-lines.save.v1',url='http://127.0.0.1:4211',report={checks:[],errors:[],crashCount:0};
const seed=(l,extra={})=>({version:3,levelId:l.id,levelVersion:l.version,path:[l.start],completed:[],coins:0,hints:3,themeId:'classic',ownedThemes:['classic','mint'],drafts:{},giftMilestones:0,giftNotice:null,lastOfferAt:0,offer:null,daily:{lastDate:null,pending:null,last:null},...extra});
const save=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const ready=p=>p.locator('#app[data-ready=true]').waitFor();
let browser,server;
async function open(data,{locks=true}={}){
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
 await context.addInitScript(({data,key,locks})=>{
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));
  localStorage.setItem('road-lines.feedback.v1',JSON.stringify({sound:false,vibration:false}));
  if(!locks)Object.defineProperty(navigator,'locks',{value:undefined});
 },{data,key,locks});
 const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await ready(p);return {p,context};
}
async function lastMove(p,l){
 await p.locator('[data-action=continue]').click();await p.locator('#board').focus();
 const [a,b]=l.witness.slice(-2),delta=b-a;
 await p.keyboard.press(delta===1?'ArrowRight':delta===-1?'ArrowLeft':delta===l.width?'ArrowDown':'ArrowUp');
}
async function inject(p,mode,predicate){
 await p.evaluate(({key,mode,predicate})=>{
  const set=Storage.prototype.setItem,get=Storage.prototype.getItem;
  let fired=false,unreadable=false;
  Storage.prototype.getItem=function(k){if(k===key&&unreadable)throw Error('injected read failure');return get.call(this,k);};
  Storage.prototype.setItem=function(k,v){
   if(k!==key||fired||!new Function('s',`return ${predicate}`)(JSON.parse(v)))return set.call(this,k,v);
   fired=true;
   if(mode!=='before')set.call(this,k,v);
   if(mode==='unreadable')unreadable=true;
   if(mode==='reload'){location.reload();return;}
   throw Error('injected write acknowledgement failure');
  };
  window.__restoreFault=()=>{Storage.prototype.setItem=set;Storage.prototype.getItem=get;};
 },{key,mode,predicate});
}
async function check(name,run){await run();report.checks.push(name);writeFileSync(output+'/results.json',JSON.stringify(report,null,2));console.log('PASS',name);}
try{
 if(spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'}).status!==0)throw Error('build failed');
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4211','--strictPort'],{stdio:'ignore'});
 for(let i=0;;i++){try{if((await fetch(url)).ok)break;}catch{}if(i>80)throw Error('preview');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const index of [0,19])for(const delay of [0,80,400,1200])await check(`clear ${index+1}: reload at ${delay}ms`,async()=>{
  const l=levels[index],coins=index*20,completed=levels.slice(0,index).map(x=>x.id),{p,context}=await open(seed(l,{path:l.witness.slice(0,-1),coins,completed}));
  await lastMove(p,l);await p.locator('.result-heading:visible').waitFor();if(delay)await p.waitForTimeout(delay);await p.reload();await ready(p);
  const expected=(index+1)*20+(index===19?100:0),s=await save(p);assert.equal(s.coins,expected);assert.deepEqual(s.completed,levels.slice(0,index+1).map(x=>x.id));assert.equal(s.giftNotice,index===19?20:null);
  await p.reload();await ready(p);assert.equal((await save(p)).coins,expected);await context.close();
 });
 await check('navigation immediately after durable clear write',async()=>{
  const l=levels[0],{p,context}=await open(seed(l,{path:[0,1]}));await inject(p,'reload','s.completed.includes("intro-01")');await lastMove(p,l);await ready(p);assert.equal((await save(p)).coins,20);assert.deepEqual((await save(p)).completed,[l.id]);await context.close();
 });
 for(const mode of ['before','unreadable'])await check(`clear write ${mode}: recovery and retry`,async()=>{
  const l=levels[0],{p,context}=await open(seed(l,{path:[0,1]}));await inject(p,mode,'s.completed.includes("intro-01")');await lastMove(p,l);await p.locator('.notice:visible').waitFor();
  await p.reload();await ready(p);assert.equal((await save(p)).coins,mode==='before'?0:20);
  if(mode==='before')await lastMove(p,l);
  await p.reload();await ready(p);assert.equal((await save(p)).coins,20);assert.deepEqual((await save(p)).completed,[l.id]);await context.close();
 });
 for(const mode of ['before','unreadable'])await check(`theme purchase ${mode}: wallet and ownership stay atomic`,async()=>{
  const {p,context}=await open(seed(levels[0],{coins:700}));await p.locator('[data-action=themes]:visible').click();await p.locator('[data-action=select-theme][data-theme-id=dusk]').click();await inject(p,mode,'s.ownedThemes.includes("dusk")');await p.locator('[data-action=buy-theme]').click();await p.reload();await ready(p);const s=await save(p);assert.equal(s.coins,mode==='before'?700:200);assert.equal(s.ownedThemes.includes('dusk'),mode!=='before');assert.equal(s.themeId,mode==='before'?'classic':'dusk');await context.close();
 });
 await check('hint cancelled by pause never charges; confirmed hint debit survives restart',async()=>{
  const {p,context}=await open(seed(levels[2]));await p.locator('[data-action=continue]').click();await p.evaluate(()=>{document.querySelector('[data-action=hint]').click();document.querySelector('[data-action=pause]').click();});await p.waitForTimeout(1600);assert.equal((await save(p)).hints,3);await p.locator('[data-action=resume]').click();await p.locator('[data-action=hint]').click();await p.getByText('Бледная линия показывает продолжение.',{exact:true}).waitFor();assert.equal((await save(p)).hints,2);await p.reload();await ready(p);assert.equal((await save(p)).hints,2);await context.close();
 });
 await check('second tab cannot write; closing owner transfers lock after reload',async()=>{
  const {p,context}=await open(seed(levels[0],{path:[0,1],coins:40}));const before=await save(p),second=await context.newPage();await second.goto(url);await second.locator('.fatal:visible').waitFor();assert.deepEqual(await save(second),before);await lastMove(p,levels[0]);assert.equal((await save(p)).coins,60);await p.close();await second.reload();await ready(second);assert.equal((await save(second)).coins,60);await context.close();
 });
 await check('without Web Locks: storage event blocks stale window and preserves reward',async()=>{
  const {p,context}=await open(seed(levels[0],{path:[0,1],coins:40}),{locks:false});const second=await context.newPage();await second.goto(url);await ready(second);await lastMove(p,levels[0]);await second.waitForFunction(()=>document.querySelector('#app').dataset.blocked==='true');const before=await save(second);await second.locator('[data-action=continue]').evaluate(b=>b.click());assert.deepEqual(await save(second),before);assert.equal(before.coins,60);await p.close();await second.reload();await ready(second);assert.equal((await save(second)).coins,60);await context.close();
 });
 for(const boundary of ['staged','committed'])await check(`renderer crash with wheel ${boundary}: fixed prize once`,async()=>{
  const {p,context}=await open(seed(levels[0],{coins:40}));await p.locator('[data-action=wheel]').click();await p.locator('.wheel-spin').click();
  await p.waitForFunction(k=>Boolean(JSON.parse(localStorage.getItem(k)).daily.pending),key);const spin=(await save(p)).daily.pending;
  if(boundary==='committed')await p.waitForFunction(k=>Boolean(JSON.parse(localStorage.getItem(k)).daily.last),key);
  const cdp=await context.newCDPSession(p);p.on('crash',()=>report.crashCount++);const crashed=p.waitForEvent('crash',{timeout:10000});void cdp.send('Page.crash').catch(()=>{});await crashed;await p.close();
  const replacement=await context.newPage();await replacement.goto(url);await ready(replacement);const s=await save(replacement);assert.equal(s.coins,40+[20,30,50,75,100,150,200,300][spin.sector]);assert.equal(s.daily.pending,null);assert.equal(s.daily.last.id,spin.id);await replacement.reload();await ready(replacement);assert.equal((await save(replacement)).coins,s.coins);await context.close();
 });
 assert.equal(report.crashCount,2);assert.deepEqual(report.errors,[]);console.log('Persistence browser checks:',report.checks.length);
}catch(e){report.errors.push(e.stack);process.exitCode=1;}finally{writeFileSync(output+'/results.json',JSON.stringify(report,null,2));await browser?.close();server?.kill('SIGTERM');}
