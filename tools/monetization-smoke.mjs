import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync,readdirSync } from 'node:fs';
const out='.test-output/monetization';mkdirSync(out,{recursive:true});
const levels=JSON.parse(readFileSync('src/content/levels.ts','utf8').split('= ')[1].trim().replace(/;$/,''));
const key='road-lines.save.v1',url='http://127.0.0.1:4242';
const seed=(l=levels[2],extra={})=>({version:4,levelId:l.id,levelVersion:l.version,path:[l.start],completed:[],coins:0,hints:0,themeId:'classic',ownedThemes:['classic','mint'],drafts:{},giftMilestones:0,giftNotice:null,lastOfferAt:0,offer:null,daily:{lastDate:null,pending:null,last:null},...extra});
const report={checks:[],screens:[],errors:[]};let browser,server,lastPage;
const save=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
async function open(data,{mode='earned',width=390,height=844,lang='ru',cadence=null,video=false}={}){
 const c=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce',...(video?{recordVideo:{dir:out+'/video',size:{width,height}}}:{})});
 await c.addInitScript(({data,key,lang,cadence})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));localStorage.setItem('road-lines.locale.v1',lang);localStorage.setItem('road-lines.feedback.v1',JSON.stringify({sound:false,vibration:false}));if(cadence&&!localStorage.getItem('road-lines.ads.v1'))localStorage.setItem('road-lines.ads.v1',JSON.stringify(cadence));},{data,key,lang,cadence});
 const p=await c.newPage();lastPage=p;p.setDefaultTimeout(12000);p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url+'/?ad='+mode);await p.locator('#app[data-ready=true]').waitFor();return{p,c};
}
async function enter(p){await p.locator('[data-action=continue]').tap();}
async function shop(p){await enter(p);await p.locator('[data-action=hint]').tap();await p.locator('.hint-overlay:visible').waitFor();}
async function check(name,fn){await fn();report.checks.push(name);writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log('PASS',name);}
try{
 for(const [mode,dir]of [['ads-test','ads-dist'],['production','ads-production-dist']])assert.equal(spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode',mode,'--outDir','.test-output/'+dir],{stdio:'inherit'}).status,0);
 const prod=readdirSync('.test-output/ads-production-dist/assets').filter(f=>f.endsWith('.js')).map(f=>readFileSync('.test-output/ads-production-dist/assets/'+f,'utf8')).join('');for(const marker of ['test-ad-pending','test-stream','test-ad-seq'])assert(!prod.includes(marker),'Production excludes '+marker);
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--outDir','.test-output/ads-dist','--host','127.0.0.1','--port','4242','--strictPort'],{stdio:'ignore'});
 for(let i=0;;i++){try{if((await fetch(url)).ok)break;}catch{}if(i>80)throw Error('preview');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [width,height]of [[320,568],[360,800],[390,844],[412,915],[576,1280]])for(const lang of ['ru','en']){
  const {p,c}=await open(seed(),{width,height,lang});await enter(p);
  const banner=await p.locator('#banner-slot').boundingBox();assert.equal(Boolean(banner),height>=680);
  if(banner){const dock=await p.locator('.play-controls').boundingBox();assert(dock.y+dock.height<=banner.y);}
  await p.locator('[data-action=hint]').tap();await p.locator('.hint-overlay:visible').waitFor();assert.equal(await p.locator('#banner-slot').isVisible(),false);
  for(const b of await p.locator('.hint-shop-card button:visible').all()){const r=await b.boundingBox();assert(r.height>=48&&r.x>=0&&r.x+r.width<=width&&r.y>=0&&r.y+r.height<=height);}
  assert.equal((await save(p)).hints,0);assert.equal(await p.locator('[data-action=hint-topup]').isDisabled(),false);
  await p.screenshot({path:out+`/hint-shop-${lang}-${width}.png`});report.screens.push({width,height,lang});await p.keyboard.press('Escape');assert.equal(await p.locator('.hint-overlay').isVisible(),false);await c.close();
 }
 await check('one earned video funds exactly one three-hint pack; double tap and reload do not duplicate',async()=>{
  const {p,c}=await open(seed(),{video:true});await shop(p);await p.locator('[data-action=hint-topup]').evaluate(b=>{b.click();b.click();});await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).coins===150,key);await p.waitForFunction(()=>!localStorage.getItem('test-ad-pending'));await p.locator('[data-action=buy-hints][data-count="3"]').tap();assert.equal((await save(p)).coins,0);assert.equal((await save(p)).hints,3);await p.reload();await p.locator('#app[data-ready=true]').waitFor();assert.equal((await save(p)).coins,0);assert.equal((await save(p)).hints,3);assert.equal((await save(p)).adLedger.sequence,1);const v=p.video();await c.close();if(v)await v.saveAs(out+'/hint-topup.webm');
 });
 await check('single60 purchase is available independently and does not automatically spend the hint',async()=>{
  const {p,c}=await open(seed(levels[2],{coins:60}));await shop(p);await p.locator('[data-action=buy-hints][data-count="1"]').tap();assert.equal((await save(p)).coins,0);assert.equal((await save(p)).hints,1);await c.close();
 });
 for(const mode of ['dismiss','unavailable'])await check(mode+' does not grant money and returns to usable shop',async()=>{
  const {p,c}=await open(seed(),{mode});await shop(p);await p.locator('[data-action=hint-topup]').tap();await p.waitForFunction(()=>!document.querySelector('[data-action=hint-topup]').disabled);assert.equal((await save(p)).coins,0);assert.equal((await save(p)).hints,0);await p.keyboard.press('Escape');assert.equal(await p.locator('#app').getAttribute('data-blocked'),'false');await c.close();
 });
 await check('pending earned receipt recovers after renderer restart exactly once',async()=>{
  const {p,c}=await open(seed(),{mode:'crash'});await shop(p);await p.locator('[data-action=hint-topup]').tap();await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).coins===150,key);await p.locator('#app[data-ready=true]').waitFor();await p.reload();await p.locator('#app[data-ready=true]').waitFor();assert.equal((await save(p)).coins,150);assert.equal((await save(p)).adLedger.sequence,1);await c.close();
 });
 await check('failed durable grant retains native pending; retry restores exactly150',async()=>{
  const {p,c}=await open(seed());await shop(p);
  await p.evaluate(k=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(a,b){if(a===k&&JSON.parse(b).adLedger?.sequence===1)throw Error('disk');return set.call(this,a,b);};window.__restoreGrant=()=>Storage.prototype.setItem=set;},key);
  await p.locator('[data-action=hint-topup]').tap();await p.waitForFunction(()=>localStorage.getItem('test-ad-pending'));await p.locator('[data-action=notice]:visible').waitFor();await p.waitForTimeout(600);assert.equal((await save(p)).coins,0);assert.equal(await p.locator('#app').getAttribute('data-blocked'),'true');await p.evaluate(()=>__restoreGrant());await p.locator('[data-action=notice]').tap();await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).coins===150,key);await p.waitForFunction(()=>!localStorage.getItem('test-ad-pending'));assert.equal((await save(p)).adLedger.sequence,1);await c.close();
 });
 await check('theme shortage uses same150 topup, free preview is not ownership',async()=>{
  const l=levels[0],{p,c}=await open(seed(l,{path:l.witness,completed:[l.id],coins:400}));await enter(p);await p.locator('[data-action=try-result-theme]').tap();const id=await p.locator('.result-theme-card').getAttribute('data-theme-id');await p.locator('[data-action=try-result-theme]').tap();assert.equal((await save(p)).ownedThemes.includes(id),false);await p.locator('[data-action=theme-topup]').tap();await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).coins===550,key);await p.waitForFunction(()=>!document.querySelector('[data-action=buy-theme]').disabled);await p.locator('[data-action=buy-theme]').tap();assert.equal((await save(p)).coins,50);assert((await save(p)).ownedThemes.includes(id));await c.close();
 });
 const policy={version:1,activeMs:60000,lastAdMs:null,completedAtAd:0,unsettled:false,protectedLevel:null};
 for(const mode of ['earned','unavailable'])await check('Continue after '+mode+' interstitial advances once and persists draft',async()=>{
  const l=levels[4],{p,c}=await open(seed(l,{path:l.witness.slice(0,-1),completed:levels.slice(0,4).map(x=>x.id),coins:80}),{mode,cadence:policy});await enter(p);await p.locator('#board').focus();const d=l.witness.at(-1)-l.witness.at(-2);await p.keyboard.press(d===1?'ArrowRight':d===-1?'ArrowLeft':d===l.width?'ArrowDown':'ArrowUp');await p.locator('.result').waitFor();await p.locator('.next').evaluate(b=>{b.click();b.click();});await p.locator('.play').waitFor();assert.equal((await save(p)).levelId,levels[5].id);assert.equal((await save(p)).coins,100);await p.reload();await p.locator('#app[data-ready=true]').waitFor();assert.equal((await save(p)).levelId,levels[5].id);await c.close();
 });
 await check('dismissal while backgrounded defers exactly one next-level transition until foreground',async()=>{
  const l=levels[4],{p,c}=await open(seed(l,{path:l.witness.slice(0,-1),completed:levels.slice(0,4).map(x=>x.id),coins:80}),{cadence:policy});await enter(p);await p.locator('#board').focus();const d=l.witness.at(-1)-l.witness.at(-2);await p.keyboard.press(d===1?'ArrowRight':d===-1?'ArrowLeft':d===l.width?'ArrowDown':'ArrowUp');await p.locator('.result').waitFor();await p.locator('.next').tap();await p.waitForFunction(()=>document.querySelector('#app').dataset.blocked==='true');await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(900);assert.equal((await save(p)).levelId,l.id);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await p.locator('.play').waitFor();assert.equal((await save(p)).levelId,levels[5].id);await c.close();
 });
 await check('gift transition is protected even when interstitial would otherwise be eligible',async()=>{
  const l=levels[19],{p,c}=await open(seed(l,{path:l.witness.slice(0,-1),completed:levels.slice(0,19).map(x=>x.id),coins:380}),{cadence:policy});await enter(p);await p.locator('#board').focus();const d=l.witness.at(-1)-l.witness.at(-2);await p.keyboard.press(d===1?'ArrowRight':d===-1?'ArrowLeft':d===l.width?'ArrowDown':'ArrowUp');await p.locator('.result').waitFor();await p.locator('.next').tap();await p.locator('.bonus-overlay:visible').waitFor();await p.locator('.bonus-close').tap();await p.locator('.play').waitFor();const policyAfter=await p.evaluate(()=>JSON.parse(localStorage.getItem('road-lines.ads.v1')));assert.equal(policyAfter.lastAdMs,null);assert.equal((await save(p)).levelId,levels[20].id);assert.equal((await save(p)).coins,500);await c.close();
 });
 await check('dead-end diagnostic remains free at zero and does not open shop',async()=>{
  const {p,c}=await open(seed(levels[2],{path:[0,1,4]}));await enter(p);await p.locator('[data-action=hint]').tap();await p.locator('[data-action=notice]:visible').waitFor();assert.equal(await p.locator('.hint-overlay').isVisible(),false);await p.locator('[data-action=notice]').tap();assert.equal((await save(p)).hints,0);assert.deepEqual((await save(p)).path,[0,1]);await c.close();
 });
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
}catch(e){report.errors.push(String(e));if(lastPage)await lastPage.screenshot({path:out+'/failure.png'}).catch(()=>{});writeFileSync(out+'/results.json',JSON.stringify(report,null,2));throw e;}
finally{await browser?.close();server?.kill();}
