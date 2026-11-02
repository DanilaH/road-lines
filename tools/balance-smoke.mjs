import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.cwd(),out=resolve('.test-output/balance-audit');mkdirSync(out,{recursive:true});
if(!process.argv.includes('--prepared')){
 for(const args of [['python3',['tools/audit-bank-balance.py']],[process.execPath,['tools/performance-audit.mjs','--prepare-only']]])if(spawnSync(args[0],args[1],{stdio:'inherit'}).status!==0)process.exit(1);
}
const raw=readFileSync('src/content/levels.ts','utf8'),levels=JSON.parse(raw.slice(raw.indexOf('= ')+2).trim().replace(/;$/,'')),audit=JSON.parse(readFileSync(out+'/results.json','utf8'));
const key='road-lines.save.v1',report={probe:JSON.parse(readFileSync('.test-output/performance-audit/provenance.json','utf8')),environment:{headless:true,mobileEmulation:true,physicalDevice:false},workers:[],ui:[],errors:[]};
const flush=()=>writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));
const seed=(l,path,hints)=>({version:3,levelId:l.id,levelVersion:l.version,path,completed:levels.slice(0,2).map(l=>l.id),coins:40,hints,themeId:'classic',ownedThemes:['classic','mint'],drafts:{},giftMilestones:0,giftNotice:null,lastOfferAt:0,offer:null,daily:{lastDate:null,pending:null,last:null}});
let browser;const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','.test-output/performance-audit/probe-src','--host','127.0.0.1','--port','4221','--strictPort'],{stdio:'ignore'}),url='http://127.0.0.1:4221';
async function open(l,path,hints,width=390,height=844){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await context.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));localStorage.setItem('road-lines.feedback.v1',JSON.stringify({sound:false,vibration:false}));},{key,data:seed(l,path,hints)});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').tap();await p.waitForTimeout(600);return{p,context};
}
const save=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
try{
 for(let i=0;;i++){try{if((await fetch(url)).ok)break;}catch{}if(i>80)throw Error('preview');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const jobs=[];const keys=new Set();const add=(l,path,expected,rollback)=>{const key=l.id+':'+path.join(',');if(keys.has(key))return;keys.add(key);jobs.push({level:l,path,expected,rollback});};
 for(const [i,l]of levels.entries()){
  for(const n of [1,Math.ceil(l.cells.length/2),l.cells.length-1])add(l,l.witness.slice(0,n),'FOUND');
  const a=audit.levels[i];for(const t of a.trapExamples)add(l,t.prefix,'UNSOLVABLE',t.prefix.length-1);
  if(a.deadEndExample)add(l,a.deadEndExample.prefix,'UNSOLVABLE',a.deadEndExample.nearestSolvablePrefixLength);
 }
 {
  const {p,context}=await open(levels[0],[levels[0].start],3);p.on('console',m=>{if(m.text().startsWith('BALANCE '))console.log(m.text());});const cdp=await context.newCDPSession(p);
  for(const rate of [1,4]){
   await cdp.send('Emulation.setCPUThrottlingRate',{rate});
   const results=await p.evaluate(async jobs=>{
    const results=[];
    function valid(l,path){const seen=new Set();if(path.length!==l.cells.length||path[0]!==l.start||(l.finish!==undefined&&path.at(-1)!==l.finish))return false;
     for(const [i,c]of path.entries()){if(!l.cells.includes(c)||seen.has(c))return false;seen.add(c);if(i){const a=path[i-1];if(Math.abs(c%l.width-a%l.width)+Math.abs(Math.floor(c/l.width)-Math.floor(a/l.width))!==1||(l.walls??[]).some(([x,y])=>a===x&&c===y||a===y&&c===x))return false;}}
     return(l.checkpoints??[]).every((c,i,cs)=>!i||path.indexOf(c)>path.indexOf(cs[i-1]));}
    for(const [i,j]of jobs.entries()){
     const at=performance.now(),answer=await __perf.hints.request(j.level,j.path);const ms=performance.now()-at;
     const bad=!answer||answer.kind!=='UNKNOWN'&&answer.kind!==j.expected||answer?.kind==='FOUND'&&(!valid(j.level,answer.path)||!j.path.every((c,i)=>answer.path[i]===c))||answer?.rollbackLength!==undefined&&answer.rollbackLength!==j.rollback;
     results.push({id:j.level.id,prefix:j.path,expected:j.expected,expectedRollback:j.rollback,kind:answer?.kind,rollbackLength:answer?.rollbackLength,ms,bad});if(i%100===99)console.log('BALANCE workers '+(i+1)+'/'+jobs.length);
    }return results;
   },jobs);
   assert(!results.some(r=>r.bad),'Worker disagrees with independent oracle');report.workers.push({cpuThrottle:rate,cases:results.length,unknown:results.filter(r=>r.kind==='UNKNOWN').length,missingRollback:results.filter(r=>r.kind==='UNSOLVABLE'&&r.rollbackLength===undefined).length,results});flush();
  }await context.close();
 }
 for(const [id,width,height,noun]of [['intro-03',320,568,'клетку'],['shapes-10',390,844,'клетки'],['shapes-20',412,915,'клеток']]){
  const l=levels.find(l=>l.id===id),a=audit.levels.find(l=>l.id===id),dead=a.deadEndExample;
  // The smallest tutorial fixture specifically catches the original zero-budget early return.
  const path=id==='intro-03'?[0,1,4]:dead.prefix,rollback=id==='intro-03'?2:dead.nearestSolvablePrefixLength;
  const {p,context}=await open(l,path,0,width,height);await p.locator('[data-action=hint]').tap();await p.getByRole('button',{name:'Вернуться',exact:true}).waitFor();
  const notice=await p.locator('.notice span').textContent();assert(notice.includes(noun));assert.equal((await save(p)).hints,0);assert.deepEqual((await save(p)).path,path);assert.equal((await save(p)).coins,40);
  const box=await p.locator('.notice').boundingBox();assert(box.x>=0&&box.x+box.width<=width);const target=await p.locator('[data-action=notice]').boundingBox();assert(target.height>=44);await p.screenshot({path:out+'/'+id+'-free-rollback-'+width+'.png'});
  await p.locator('[data-action=notice]').tap();assert.deepEqual((await save(p)).path,path.slice(0,rollback));assert.equal((await save(p)).hints,0);await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').tap();assert.deepEqual((await save(p)).path,path.slice(0,rollback));
  report.ui.push({check:'Free zero-budget nearest rollback and reload',id,width,height,notice,rollback});await context.close();flush();
 }
 {
  const l=levels[2],{p,context}=await open(l,[0,1],1);await p.locator('[data-action=hint]').tap();await p.getByText('Бледная линия показывает продолжение.',{exact:true}).waitFor();assert.equal((await save(p)).hints,0);await p.locator('[data-action=hint]').tap();assert.equal((await save(p)).hints,0);await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').tap();await p.locator('[data-action=hint]').tap();await p.locator('.hint-overlay:visible').waitFor();assert.equal(await p.locator('[data-action=buy-hints][data-count=\"1\"]').isDisabled(),true);assert.equal((await save(p)).hints,0);assert.deepEqual((await save(p)).path,[0,1]);assert.equal(await p.evaluate(()=>__perf.scene.hint.length),0);
  report.ui.push({check:'Paid last hint becomes zero; same-session repeat is free, reload does not reveal a new paid hint'});await context.close();
 }
 {
  const {p,context}=await open(levels[2],[0,1,4],0);await p.route('**/assets/hint.worker-*.js',r=>r.abort());await p.locator('[data-action=hint]').tap();await p.getByText('Сейчас не удалось найти продолжение. Подсказка не потрачена.',{exact:true}).waitFor();assert.equal((await save(p)).hints,0);assert.deepEqual((await save(p)).path,[0,1,4]);assert.equal(await p.getByRole('button',{name:'Вернуться',exact:true}).isVisible(),false);report.ui.push({check:'Unavailable worker at zero budget is UNKNOWN, no false dead-end/charge'});await context.close();
 }
 {
  const {p,context}=await open(levels[2],[0,1,4],0);await p.locator('[data-action=hint]').evaluate(b=>b.click());await p.locator('[data-action=restart]').evaluate(b=>b.click());await p.waitForTimeout(400);assert.deepEqual((await save(p)).path,[0]);assert.equal((await save(p)).hints,0);assert.equal(await p.getByRole('button',{name:'Вернуться',exact:true}).isVisible(),false);report.ui.push({check:'Reset cancels an in-flight zero-budget diagnosis; stale rollback is discarded'});await context.close();
 }
 {
  const {p,context}=await open(levels[2],[0,1,4],0);await p.locator('[data-action=hint]').tap();await p.getByRole('button',{name:'Вернуться',exact:true}).waitFor();await p.locator('[data-action=pause]').tap();await p.locator('[data-action=resume]').tap();
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await p.locator('[data-action=notice]').tap();assert.deepEqual((await save(p)).path,[0,1]);assert.equal((await save(p)).hints,0);report.ui.push({check:'Confirmed zero-budget rollback survives pause and document background, then still applies'});await context.close();
 }
 {
  const {p,context}=await open(levels[2],[0,1],1);await p.locator('[data-action=hint]').tap();await p.getByText('Бледная линия показывает продолжение.',{exact:true}).waitFor();const hint=await p.evaluate(()=>[...__perf.scene.hint]);assert(hint.length>1);await p.locator('[data-action=pause]').tap();await p.locator('[data-action=resume]').tap();assert.deepEqual(await p.evaluate(()=>__perf.scene.hint),hint);await p.locator('[data-action=hint]').tap();assert.equal((await save(p)).hints,0);report.ui.push({check:'Confirmed paid hint survives pause and repeats for free at zero budget'});await context.close();
 }
 assert.deepEqual(report.errors,[]);console.log('Balance smoke passed',jobs.length,'oracle jobs × 2 CPU rates,',report.ui.length,'UI checks');
}catch(e){report.errors.push(e.stack);process.exitCode=1;}finally{flush();await browser?.close();server.kill('SIGTERM');}
