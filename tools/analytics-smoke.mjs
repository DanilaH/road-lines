import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const out='.test-output/analytics';mkdirSync(out,{recursive:true});
const key='road-lines.save.v1',raw=readFileSync('src/content/levels.ts','utf8'),levels=JSON.parse(raw.slice(raw.indexOf('= ')+2).trim().replace(/;$/,''));
const seed=(l,extra={})=>({version:3,levelId:l.id,levelVersion:l.version,path:[l.start],completed:[],coins:0,hints:3,themeId:'classic',ownedThemes:['classic','mint'],drafts:{},giftMilestones:0,giftNotice:null,lastOfferAt:0,offer:null,daily:{lastDate:null,pending:null,last:null},...extra});
const report={checks:[],errors:[],externalRequests:[],events:[]},url='http://127.0.0.1:4215';let browser,server;
async function open(data){
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,typeof data==='string'?data:JSON.stringify(data));localStorage.setItem('road-lines.feedback.v1',JSON.stringify({sound:false,vibration:false}));},{key,data});
 const p=await context.newPage();p.setDefaultTimeout(15000);const events=[];
 p.on('console',m=>{if(m.text().startsWith('__ROAD_EVENT__')){const e=JSON.parse(m.text().slice(14));events.push(e);report.events.push(e);}});p.on('pageerror',e=>report.errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))report.externalRequests.push(r.url());});
 await p.goto(url);if(typeof data==='string')await p.locator('.fatal').waitFor();else await p.locator('#app[data-ready=true]').waitFor();return {p,context,events};
}
const count=(events,name)=>events.filter(e=>e.event===name).length;
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS',name);}
try{
 if(spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','analytics-test','--outDir','.test-output/analytics-dist'],{stdio:'inherit'}).status!==0)throw Error('build');
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--outDir','.test-output/analytics-dist','--host','127.0.0.1','--port','4215','--strictPort'],{stdio:'ignore'});
 for(let i=0;;i++){try{if((await fetch(url)).ok)break;}catch{}if(i>80)throw Error('preview');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 await check('visits, first move, resets, pause/background and explicit exit have no redraw duplicates',async()=>{
  const {p,context,events}=await open(seed(levels[2]));assert.equal(count(events,'app_ready'),1);assert.equal(count(events,'level_start'),0);
  await p.locator('[data-action=continue]').click();await p.locator('#board').focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowLeft');await p.locator('[data-action=restart]').click();
  await p.locator('[data-action=pause]').click();await p.locator('[data-action=language][data-language=en]').click();await p.locator('[data-action=resume]').click();
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await p.locator('[data-action=pause]').click();await p.locator('[data-action=home]:visible').click();assert.equal(count(events,'level_start'),1);assert.equal(count(events,'first_move'),1);assert.equal(count(events,'level_reset'),1);assert.equal(count(events,'level_exit'),1);assert.equal(count(events,'language_change'),1);assert.equal(count(events,'level_pause'),3);
  const exit=events.find(e=>e.event==='level_exit');assert.equal(exit.params.resets,1);assert.equal(exit.params.undo_cells,1);await p.locator('[data-action=continue]').click();assert.equal(count(events,'level_start'),2);await context.close();
 });
 await check('confirmed win once, double Continue once, reload of result never repeats completion',async()=>{
  const {p,context,events}=await open(seed(levels[0],{path:[0,1]}));await p.locator('[data-action=continue]').click();await p.locator('#board').focus();await p.keyboard.press('ArrowRight');await p.locator('.result-heading:visible').waitFor();assert.equal(count(events,'level_complete'),1);assert.equal(events.find(e=>e.event==='level_complete').params.reward,20);
  await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').click();assert.equal(count(events,'level_complete'),1);await p.locator('.next').evaluate(b=>{b.click();b.click();});await p.locator('.play').waitFor();assert.equal(events.filter(e=>e.event==='level_start'&&e.params.level_id===levels[1].id).length,1);await context.close();
 });
 await check('hint cancelled, spent, repeated, and failed write are distinct outcomes',async()=>{
  const {p,context,events}=await open(seed(levels[2]));await p.locator('[data-action=continue]').click();await p.evaluate(()=>{document.querySelector('[data-action=hint]').click();document.querySelector('[data-action=pause]').click();});await p.waitForTimeout(100);await p.locator('[data-action=resume]').click();await p.locator('[data-action=hint]').click();await p.getByText('Бледная линия показывает продолжение.',{exact:true}).waitFor();await p.locator('[data-action=hint]').click();assert.equal(count(events,'hint_request'),2);assert.equal(count(events,'hint_spent'),1);assert.equal(count(events,'hint_repeat'),1);assert(events.some(e=>e.event==='hint_result'&&e.params.outcome==='cancelled'));
  await p.locator('#board').focus();await p.keyboard.press('ArrowRight');await p.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='road-lines.save.v1')throw Error('private disk text');return set.call(this,k,v);};});await p.locator('[data-action=hint]').click();await p.locator('.notice:visible').waitFor();await p.waitForTimeout(100);assert.equal(count(events,'hint_spent'),1);assert(events.some(e=>e.event==='hint_result'&&e.params.outcome==='save_failed'));assert.equal(count(events,'save_error'),1);assert(!JSON.stringify(events).includes('private disk text'));await context.close();
 });
 for(const [name,path,hints,workerFailure,outcome]of [['no budget',[0],0,false,'no_budget'],['dead end',[0,1,4],0,false,'dead_end'],['worker unavailable',[0],3,true,'unknown']])await check(`hint ${name}: diagnostic outcome without debit`,async()=>{
  const {p,context,events}=await open(seed(levels[2],{path,hints}));if(workerFailure)await p.evaluate(()=>{window.Worker=class{constructor(){throw Error('worker unavailable');}};});await p.locator('[data-action=continue]').click();await p.locator('[data-action=hint]').click();await p.waitForFunction(()=>!document.querySelector('[data-action=hint]').disabled);assert(events.some(e=>e.event==='hint_result'&&e.params.outcome===outcome));assert.equal(count(events,'hint_spent'),0);assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).hints,key),hints);await context.close();
 });
 await check('new daily claim reports once after commit, not again on Back/reload',async()=>{
  const {p,context,events}=await open(seed(levels[0]));await p.locator('[data-action=wheel]').click();await p.locator('.wheel-spin').evaluate(b=>{b.click();b.click();});await p.waitForFunction(k=>Boolean(JSON.parse(localStorage.getItem(k)).daily.last),key);assert.equal(count(events,'wheel_reward'),1);const e=events.find(e=>e.event==='wheel_reward');assert.equal(e.params.recovered,false);assert.equal(e.params.amount,e.params.theme?0:[20,30,50,75,100,150,200,300][e.params.sector]);await p.keyboard.press('Escape');await p.reload();await p.locator('#app[data-ready=true]').waitFor();assert.equal(count(events,'wheel_reward'),1);await context.close();
 });
 await check('purchase reports only after durable grant; selecting owned theme is separate',async()=>{
  const {p,context,events}=await open(seed(levels[0],{coins:700}));await p.locator('[data-action=themes]:visible').click();await p.locator('[data-theme-id=dusk]').click();await p.locator('[data-action=buy-theme]').click();await p.locator('[data-theme-id=mint]').click();await p.locator('[data-theme-id=dusk]').click();await p.locator('[data-theme-id=dusk]').click();assert.equal(count(events,'theme_purchase'),1);assert.equal(events.find(e=>e.event==='theme_purchase').params.price,500);assert.equal(count(events,'theme_selected'),2);await context.close();
 });
 await check('pending wheel recovery is attributed once across subsequent reload',async()=>{
  const {p,context,events}=await open(seed(levels[0],{daily:{lastDate:'2026-11-01',pending:{id:'recover',date:'2026-11-01',sector:5},last:null}}));assert.equal(count(events,'wheel_reward'),1);assert.equal(events.find(e=>e.event==='wheel_reward').params.recovered,true);await p.reload();await p.locator('#app[data-ready=true]').waitFor();assert.equal(count(events,'wheel_reward'),1);await context.close();
 });
 await check('corrupt save emits categorical boot error and leaves raw bytes intact',async()=>{
  const {p,context,events}=await open('{private corrupt data');assert.equal(count(events,'startup_error'),1);assert(!JSON.stringify(events).includes('private corrupt'));assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),'{private corrupt data');await context.close();
 });
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);for(const e of report.events){assert.equal(e.params.schema,1);assert(!('path'in e.params));assert(!('witness'in e.params));}
 console.log('Analytics smoke PASS',report.checks.length,'groups');
}catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;}finally{writeFileSync(out+'/results.json',JSON.stringify(report,null,2));await browser?.close();server?.kill('SIGTERM');}
