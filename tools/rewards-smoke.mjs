import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const key='road-lines.save.v1', prizes=[20,30,50,75,100,150,200,300];
const ready=p=>p.locator('#app[data-ready=true]').waitFor();
const save=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const pending=p=>p.waitForFunction(k=>Boolean(JSON.parse(localStorage.getItem(k))?.daily?.pending),key);
const settled=p=>p.waitForFunction(k=>{const s=JSON.parse(localStorage.getItem(k));return s?.daily.last&&s.daily.pending===null;},key);
async function openWheel(p){await p.locator('[data-action=wheel]').click();await p.locator('.wheel-screen:visible').waitFor();}
async function seeded(browser,url,seed){
 const p=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Yekaterinburg'});
 await p.clock.setFixedTime(new Date('2026-10-30T09:00:00Z'));
 await p.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key,seed});
 await p.goto(url);await ready(p);return p;
}
const base={version:1,levelId:'intro-01',levelVersion:1,path:[0,1],completed:[],coins:40,hints:2};
export async function runRewardsSmoke(browser,url,output,root){
 for(const [width,height] of [[320,568],[360,800],[390,844],[412,915],[576,1280]]){
  const p=await browser.newPage({viewport:{width,height}});await p.goto(url);await ready(p);await openWheel(p);
  assert.deepEqual(await p.locator('.daily-wheel text').allTextContents(),prizes.map(String));assert.equal(await p.locator('.wheel-spin').isEnabled(),true);
  assert.equal(await p.locator('#banner-slot').isVisible(),false);await p.locator('.wheel-spin').scrollIntoViewIfNeeded();
  const b=await p.locator('.wheel-spin').boundingBox();assert(b&&b.height>=48&&b.x>=0&&b.x+b.width<=width);
  await p.locator('.wheel-body').evaluate(el=>{el.scrollTop=0;});await p.screenshot({path:resolve(output,`wheel-${width}x${height}.png`)});
  await p.keyboard.press('Escape');assert.equal(await p.locator('#app').getAttribute('data-screen'),'home');await p.close();
 }
 const p=await seeded(browser,url,base),errors=[];p.on('pageerror',e=>errors.push(e.message));await openWheel(p);
 await p.locator('.wheel-spin').evaluate(b=>{b.click();b.click();});await pending(p);const staged=(await save(p)).daily.pending;
 assert.equal((await save(p)).coins,40,'Stage owns outcome, not its animated reward');await p.waitForTimeout(650);await p.screenshot({path:resolve(output,'wheel-spinning.png')});await settled(p);
 assert.equal((await save(p)).coins,40+prizes[staged.sector]);const result=await save(p);
 await p.locator('.wheel-result').getByText(`Выигрыш: +${prizes[staged.sector]} монет`,{exact:true}).waitFor();assert.equal(await p.locator('.wheel-spin').isDisabled(),true);
 const angle=await p.locator('.daily-wheel').evaluate(el=>Number(el.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]));assert.equal((angle+staged.sector*45)%360,0);
 await p.screenshot({path:resolve(output,'wheel-reward.png')});await p.reload();await ready(p);await openWheel(p);
 assert.equal((await save(p)).coins,result.coins);assert.equal((await save(p)).daily.last.id,staged.id);assert.deepEqual((await save(p)).path,[0,1]);assert.equal((await save(p)).hints,2);
 await p.clock.setFixedTime(new Date('2026-10-29T09:00:00Z'));await p.reload();await ready(p);await openWheel(p);assert.equal(await p.locator('.wheel-spin').isDisabled(),true);
 await p.clock.setFixedTime(new Date('2026-10-31T09:00:00Z'));await p.reload();await ready(p);await openWheel(p);assert.equal(await p.locator('.wheel-spin').isEnabled(),true);
 await p.locator('.wheel-spin').click();await pending(p);const second=(await save(p)).daily.pending;await p.keyboard.press('Escape');await settled(p);await p.waitForTimeout(3900);
 assert.equal(await p.locator('#app').getAttribute('data-screen'),'home');assert.equal((await save(p)).coins,result.coins+prizes[second.sector]);assert.equal(await p.locator('.daily-wheel').evaluate(el=>el.getAnimations().length),0);assert.deepEqual(errors,[]);await p.close();
 const reload=await seeded(browser,url,base);await openWheel(reload);await reload.locator('.wheel-spin').click();await pending(reload);const reserved=(await save(reload)).daily.pending;
 await reload.reload();await ready(reload);assert.equal((await save(reload)).coins,40+prizes[reserved.sector]);assert.equal((await save(reload)).daily.last.id,reserved.id);assert.equal((await save(reload)).daily.pending,null);
 await reload.reload();await ready(reload);assert.equal((await save(reload)).coins,40+prizes[reserved.sector]);await reload.close();
 const bg=await seeded(browser,url,base);await openWheel(bg);await bg.locator('.wheel-spin').click();await pending(bg);const hidden=(await save(bg)).daily.pending;
 await bg.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await settled(bg);await bg.waitForTimeout(3900);
 assert.equal((await save(bg)).coins,40+prizes[hidden.sector]);assert.equal(await bg.locator('.wheel-sparks i').count(),0);
 await bg.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await bg.locator('.wheel-spin').isDisabled(),true);await bg.close();
 const failure=await seeded(browser,url,base);await openWheel(failure);await failure.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('disk full');};});
 await failure.locator('.wheel-spin').click();await failure.getByText('Не удалось сохранить прогресс.',{exact:true}).waitFor();assert.equal((await save(failure)).coins,40);assert.equal((await save(failure)).daily.pending,null);assert.equal((await save(failure)).daily.lastDate,null);
 await failure.reload();await ready(failure);await openWheel(failure);assert.equal(await failure.locator('.wheel-spin').isEnabled(),true);await failure.close();
 const text=readFileSync(resolve(root,'src/content/levels.ts'),'utf8'),levels=JSON.parse(text.slice(text.indexOf('= ')+2).trim().replace(/;$/,'')),tenth=levels[9];
 const offer=await seeded(browser,url,{...base,levelId:tenth.id,path:tenth.witness,completed:levels.slice(0,9).map(l=>l.id),coins:180});
 await offer.locator('[data-action=continue]').click();await offer.getByRole('button',{name:'ДАЛЬШЕ',exact:true}).click();await offer.getByRole('dialog',{name:'Новое оформление',exact:true}).waitFor();
 assert.equal((await save(offer)).coins,200);assert.equal((await save(offer)).offer.themeId,'lagoon');assert.equal(await offer.locator('.bonus-video').isDisabled(),true);
 await offer.screenshot({path:resolve(output,'theme-offer.png')});await offer.keyboard.press('Escape');assert.equal(await offer.locator('.result-heading').isVisible(),true);assert.equal((await save(offer)).offer,null);assert.equal((await save(offer)).coins,200);
 await offer.getByRole('button',{name:'ДАЛЬШЕ',exact:true}).click();assert.equal((await save(offer)).levelId,levels[10].id);await offer.close();
 console.log('Rewards: wheel viewports, durable stage/finish/reload, rollback date, Back/background, disk failure, tenth-clear offer passed.');
}
