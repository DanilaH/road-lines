import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn,spawnSync } from 'node:child_process';
import { mkdirSync,writeFileSync } from 'node:fs';
const out='.test-output/reload-touch';mkdirSync(out,{recursive:true});const report={checks:[],errors:[]};let browser,server;
try{
 if(spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'}).status!==0)throw Error('build');
 const url='http://127.0.0.1:4218';server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4218','--strictPort'],{stdio:'ignore'});
 for(let i=0;;i++){try{if((await fetch(url)).ok)break;}catch{}if(i>80)throw Error('server');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const cpu of [1,4])for(const lang of ['ru','en']){
  const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});
  await context.addInitScript(lang=>{if(!localStorage.getItem('road-lines.save.v1'))localStorage.setItem('road-lines.save.v1',JSON.stringify({version:3,levelId:'intro-03',levelVersion:1,path:[0,1,2,5,4,3],completed:['intro-01','intro-02','intro-03'],coins:820,hints:3,themeId:'lagoon',ownedThemes:['classic','mint','lagoon'],drafts:{},giftMilestones:0,giftNotice:null,lastOfferAt:0,offer:null,daily:{lastDate:null,pending:null,last:null}}));localStorage.setItem('road-lines.locale.v1',lang);window.__trace=[];for(const name of ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','click','resize'])window.addEventListener(name,e=>{window.__trace.push({type:name,target:e.target?.tagName,action:e.target?.closest?.('[data-action]')?.dataset.action,screen:document.querySelector('#app')?.dataset.screen,at:performance.now()});if(window.__trace.length>50)window.__trace.shift();},true);},lang);
  const p=await context.newPage();p.setDefaultTimeout(15000);const cdp=await context.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});await p.goto(url);
  for(let i=0;i<15;i++){
   await p.locator('#app[data-ready=true]').waitFor();await p.locator('[data-action=continue]').tap();await p.waitForTimeout(100);const state=await p.locator('#app').getAttribute('data-screen');
   if(state!=='game'){report.failure={cpu,lang,i,state,trace:await p.evaluate(()=>__trace)};await p.screenshot({path:out+'/failure.png'});}
   assert.equal(state,'game');report.checks.push({cpu,lang,i});await p.reload();
  }
  await context.close();console.log('Reload touches PASS',cpu,lang);
 }
}catch(e){report.errors.push(e.stack);console.error(e);}finally{writeFileSync(out+'/results.json',JSON.stringify(report,null,2));await browser?.close();server?.kill('SIGTERM');if(report.errors.length)process.exitCode=1;}
