import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn,spawnSync } from 'node:child_process';
import { mkdirSync,writeFileSync } from 'node:fs';
const out='.test-output/startup-ads';mkdirSync(out,{recursive:true});
const before=process.argv.includes('--reproduce-before');
assert.equal(spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','ads-test','--outDir',out+'/dist'],{stdio:'inherit'}).status,0);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--outDir',out+'/dist','--port','4248','--strictPort'],{stdio:'ignore'});
let browser;const report={checks:[],errors:[]};
try{
 for(let i=0;;i++){try{if((await fetch('http://127.0.0.1:4248')).ok)break;}catch{}if(i>80)throw Error('preview');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const mode of before?['startup-status-hang']:['startup-status-hang','startup-pending-delay','startup-pending-hang']){
  const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://127.0.0.1:4248/?ad='+mode);
  if(before){await p.waitForTimeout(16000);assert.equal(await p.locator('#app').getAttribute('data-ready'),null);assert((await p.locator('#startup').textContent()).includes('слишком много времени'));console.log('REPRODUCED: unresolved native status prevents app readiness and reaches15s startup warning');await c.close();break;}
  await p.locator('#app[data-ready=true]').waitFor({timeout:4500});assert.equal(await p.locator('#startup').count(),0);
  if(mode==='startup-pending-hang'){
   await p.locator('.notice:visible').waitFor({timeout:7000});assert.equal(await p.locator('#app').getAttribute('data-blocked'),'true');
   assert.equal(await p.locator('.fatal').count(),0);
  }else{
   await p.locator('#app[data-blocked=false]').waitFor({timeout:4500});await p.locator('[data-action=continue]').click();await p.locator('.play').waitFor();await p.locator('[data-action=pause]').click();await p.locator('.pause-overlay:visible').waitFor();await p.keyboard.press('Escape');
  }
  report.checks.push(mode);await c.close();
 }
 assert.deepEqual(report.errors,[]);writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log('Startup checks passed',report.checks);
}finally{await browser?.close();server.kill();}
