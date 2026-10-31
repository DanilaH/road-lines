import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
const root=process.cwd(), output=resolve(root,'.test-output/ux-polish');mkdirSync(output,{recursive:true});
const text=readFileSync(resolve(root,'src/content/levels.ts'),'utf8'), levels=JSON.parse(text.slice(text.indexOf('= ')+2).trim().replace(/;$/,''));
const key='road-lines.save.v1';
const seed=(level,extra={})=>({version:3,levelId:level.id,levelVersion:level.version,path:[level.start],completed:[],coins:0,hints:3,themeId:'classic',ownedThemes:['classic','mint'],drafts:{},giftMilestones:Math.floor((extra.completed?.length??0)/20),giftNotice:null,lastOfferAt:0,offer:null,daily:{lastDate:null,pending:null,last:null},...extra});
const save=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
export async function runUXSmoke(browser,url){
 const report={errors:[],checks:[],screens:[]};
 async function open(data,{width=390,height=844,reduced=false,video=false}={}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,reducedMotion:reduced?'reduce':'no-preference',...(video?{recordVideo:{dir:resolve(output,'video'),size:{width,height}}}:{})});
  await context.addInitScript(({data,key})=>{localStorage.setItem(key,JSON.stringify(data));localStorage.setItem('road-lines.feedback.v1',JSON.stringify({sound:false,vibration:false}));window.__cssWrites=0;const set=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(n,...a){if(n.startsWith('--'))window.__cssWrites++;return set.call(this,n,...a);};},{data,key});
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').click();await p.waitForTimeout(650);return {p,context};
 }
 async function center(p,l,c){const b=await p.locator('#board').boundingBox(),xs=l.cells.map(c=>c%l.width),ys=l.cells.map(c=>Math.floor(c/l.width)),cols=Math.max(...xs)-Math.min(...xs)+1,rows=Math.max(...ys)-Math.min(...ys)+1,s=Math.min(56*Math.min(b.width/390,1.5),(b.width-40)/(cols+(cols-1)/7),(b.height-64)/(rows+(rows-1)/7));return{x:b.x+(b.width-cols*s-(cols-1)*s/7)/2+(c%l.width-Math.min(...xs))*s*8/7+s/2,y:b.y+(b.height-rows*s-(rows-1)*s/7)/2+(Math.floor(c/l.width)-Math.min(...ys))*s*8/7+s/2};}
 async function drag(p,l,path){let a=await center(p,l,path[0]);await p.mouse.move(a.x,a.y);await p.mouse.down();for(const c of path.slice(1)){a=await center(p,l,c);await p.mouse.move(a.x,a.y);}await p.mouse.up();}
 async function videoDone(p,context,name){const v=p.video();await context.close();if(v)await v.saveAs(resolve(output,name+'.webm'));}
 {
  const l=levels[2],{p,context}=await open(seed(l),{width:360,height:779,video:true});
  await p.locator('[data-action=hint]').click();await p.getByText('Бледная линия показывает продолжение.',{exact:true}).waitFor();assert.equal((await save(p)).hints,2);await p.waitForTimeout(650);
  await p.locator('[data-action=hint]').click();assert.equal((await save(p)).hints,2);assert.deepEqual((await save(p)).path,[0]);await p.waitForTimeout(650);
  await drag(p,l,[0,1]);await p.getByRole('button',{name:'Подсказка, осталось 2',exact:true}).click();await p.getByText('Бледная линия показывает продолжение.',{exact:true}).waitFor();assert.equal((await save(p)).hints,1);
  await drag(p,l,[1,2,5]);await p.waitForTimeout(450);assert.deepEqual((await save(p)).path,[0,1,2,5]);await videoDone(p,context,'hint-resume');console.log('UX check complete');report.checks.push('Same-prefix hint charged once, changed prefix charged independently, release/resume');
 }
 for(const [id,path,next,copy] of [['finish-01',[0,1,2,5],8,'Финиш — после всех клеток'],['walls-01',[0,3,6,7],8,'Здесь стенка — обойди её'],['checkpoints-01',[0,1,2,5],8,'Сначала точка 2']]){
  const l=levels.find(l=>l.id===id),{p,context}=await open(seed(l,{path}),{width:360,height:779,video:id==='walls-01'});
  const writes=await p.evaluate(()=>__cssWrites);await drag(p,l,[path.at(-1),next]);await p.locator('.instruction.rejected').getByText(copy,{exact:true}).waitFor();assert.deepEqual((await save(p)).path,path);
  assert.equal(await p.evaluate(()=>__cssWrites),writes,'Rejected input does not reapply theme');await p.screenshot({path:resolve(output,'reject-'+id+'.png')});
  await p.waitForTimeout(1550);assert.equal(await p.locator('.instruction.rejected').count(),0);
  const reverse=[path.at(-1),path.at(-2)];await drag(p,l,reverse);assert.deepEqual((await save(p)).path,path.slice(0,-1));
  assert.equal(await p.evaluate(()=>__cssWrites),writes,'Accepted route updates do not rewrite CSS theme variables');
  if(id==='walls-01'){
   await p.locator('[data-action=restart]').click();await drag(p,l,l.witness);await p.locator('.result').waitFor();await p.waitForTimeout(1100);
   const coins=(await save(p)).coins;assert.equal(coins,20);await p.locator('.next').evaluate(b=>{b.click();b.click();});await p.locator('.play').waitFor();assert.equal((await save(p)).levelId,'walls-02');assert.equal((await save(p)).coins,coins);await p.waitForTimeout(650);
  }
  await videoDone(p,context,'wall-feedback');console.log('UX check complete');report.checks.push(id+': explanation, unchanged prefix, expiry, legal reverse, zero theme writes');
 }
 {
  const l=levels[9],{p,context}=await open(seed(l,{path:l.witness,completed:levels.slice(0,9).map(l=>l.id),coins:180}));await p.locator('.next').click();await p.locator('.play').waitFor();assert.equal((await save(p)).levelId,levels[10].id);assert.equal((await save(p)).offer,null);assert.equal(await p.locator('.bonus-overlay').isVisible(),false);assert.equal(await p.locator('.multiply').isVisible(),false);await context.close();console.log('UX check complete');report.checks.push('Tenth-clear Continue skips unavailable offer');
 }
 for(const back of [false,true]){
  const l=levels[19],{p,context}=await open(seed(l,{path:l.witness,completed:levels.slice(0,19).map(l=>l.id),coins:380}),{width:360,height:779,video:!back});
  assert.equal((await save(p)).coins,500);await p.locator('.next').click();await p.getByRole('dialog',{name:'Подарок!',exact:true}).waitFor();await p.waitForTimeout(700);
  if(back){await p.keyboard.press('Escape');assert.equal((await save(p)).levelId,l.id);assert.equal(await p.locator('.result').isVisible(),true);await p.locator('.next').click();}
  else await p.locator('[data-action=close-bonus]').evaluate(b=>{b.click();b.click();});
  await p.locator('.play').waitFor();assert.equal((await save(p)).levelId,levels[20].id);assert.equal((await save(p)).coins,500);assert.equal((await save(p)).giftNotice,null);await p.waitForTimeout(650);await videoDone(p,context,'gift-continue');console.log('UX check complete');report.checks.push(back?'Back cancels auto-advance intent':'Gift confirmation continues exactly once');
 }
 {
  const l=levels[19],{p,context}=await open(seed(l,{path:l.witness,completed:levels.slice(0,19).map(l=>l.id),coins:380}));await p.locator('.next').click();
  await p.evaluate(()=>{const original=Storage.prototype.setItem;window.__restoreWrites=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=()=>{throw Error('disk full');};});
  await p.locator('[data-action=close-bonus]').click();assert.equal(await p.locator('.bonus-overlay').isVisible(),true);assert.equal((await save(p)).levelId,l.id);assert.equal((await save(p)).coins,500);await p.evaluate(()=>__restoreWrites());await p.locator('[data-action=notice]').click();await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').click();await p.locator('.next').click();await p.locator('[data-action=close-bonus]').click();await p.locator('.play').waitFor();assert.equal((await save(p)).coins,500);await context.close();console.log('UX check complete');report.checks.push('Failed gift acknowledgement retains reward and resumes after authoritative reload');
 }
 {
  const l=levels[29],{p,context}=await open(seed(l,{path:l.witness,completed:levels.slice(0,29).map(l=>l.id),coins:680}));await p.locator('.next').click();await p.locator('.bank-complete').waitFor();assert.equal((await save(p)).levelId,l.id);await p.keyboard.press('Escape');await p.keyboard.press('Escape');assert.match(await p.locator('.home-play').textContent(),/Выбрать набор/);await p.locator('.home-play').click();assert.equal(await p.locator('#app').getAttribute('data-screen'),'sets');await context.close();console.log('UX check complete');report.checks.push('Set boundary stays explicit; home primary selects a set');
 }
 {
  const l=levels[2],{p,context}=await open(seed(l,{completed:levels.slice(0,30).map(l=>l.id)}));
  assert.equal((await save(p)).levelId,l.id);await drag(p,l,[0,1]);await p.locator('[data-action=pause]').click();await p.setViewportSize({width:320,height:568});await p.waitForTimeout(350);
  assert.equal(await p.locator('#app').getAttribute('data-blocked'),'true');
  await p.locator('.pause-overlay').evaluate(e=>e.hidden=true);
  const board=await p.locator('#board').boundingBox(), image=(await p.screenshot({clip:board})).toString('base64');
  const colored=await p.evaluate(async data=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+2]>pixels[i]+40&&pixels[i]>pixels[i+1]+20&&pixels[i+1]<150)n++;return n;},image);
  assert(colored>500,'Sleeping canvas repaints the purple route after resize');await p.locator('.pause-overlay').evaluate(e=>e.hidden=false);await p.keyboard.press('Escape');await p.locator('#board').focus();await p.keyboard.press('ArrowRight');assert.deepEqual((await save(p)).path,[0,1,2]);await context.close();console.log('UX check complete');report.checks.push('Replay remains resumable in a completed set; paused resize paints once and resumes exact prefix');
 }
 for(const [width,height] of [[320,568],[360,800],[390,844],[412,915],[576,1280]])for(const theme of ['classic','neon']){
  const l=levels[89],data={...seed(l),version:3,themeId:theme,ownedThemes:['classic','mint',...(theme==='neon'?['neon']:[])],drafts:{},giftMilestones:0,giftNotice:null,lastOfferAt:0,offer:null,daily:{lastDate:null,pending:null,last:null}}, {p,context}=await open(data,{width,height,reduced:theme==='neon'});
  const ins=await p.locator('.instruction').boundingBox(),banner=await p.locator('#banner-slot').boundingBox();assert(ins.y+ins.height<=banner.y);await p.screenshot({path:resolve(output,`late-${theme}-${width}.png`)});
  await p.locator('[data-action=pause]').click();await p.locator('[data-action=themes]:visible').click();assert.equal(await p.locator('.preview-start').count(),8);await p.waitForTimeout(350);await p.screenshot({path:resolve(output,`themes-${theme}-${width}.png`)});report.screens.push({width,height,theme});await context.close();
 }
 assert.deepEqual(report.errors,[]);writeFileSync(resolve(output,'results.json'),JSON.stringify(report,null,2));console.log('UX polish:',report.checks.length,'flow checks,',report.screens.length,'viewport/theme combinations passed.');
}
if(process.argv.includes('--run')){
 if(spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'}).status!==0)process.exit(1);
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4197','--strictPort'],{stdio:'ignore'});let browser;
 try{for(let n=0;;n++){try{if((await fetch('http://127.0.0.1:4197')).ok)break;}catch{}if(n>100)throw Error('server');await new Promise(r=>setTimeout(r,100));}browser=await chromium.launch({headless:true,args:['--no-sandbox']});await runUXSmoke(browser,'http://127.0.0.1:4197');}finally{await browser?.close();server.kill('SIGTERM');}
}
