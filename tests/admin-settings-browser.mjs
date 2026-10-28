// Actual same-origin Settings → loopback bridge → Wrangler Worker → persisted D1.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const backendRequire=createRequire(new URL('../backend/package.json',import.meta.url));
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
import {openLocalDatabase,manageAccount} from '../backend/tools/operator-local.mts';
const playwright=await import(process.env.FA_ADMIN_PLAYWRIGHT||'playwright');
// Fail before opening servers when a browser is missing; never count it as a skip.
const browser=await playwright.chromium.launch({headless:true});
const state=await mkdtemp(join(tmpdir(),'fa-admin-browser-'));
let worker,preview,logs='',checks=0,preparedWorld=null;
const freePort=async()=>{const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port};
const password='browser-synthetic-password-2026';
try{
 const workerPort=await freePort(),origin='http://localhost:2000';
 const handle=await openLocalDatabase(state);try{await manageAccount(handle.db,'create','operator@example.invalid',password)}finally{await handle.close()}
 worker=spawn(process.execPath,[fileURLToPath(new URL('../bin/wrangler.js',pathToFileURL(backendRequire.resolve('wrangler')).href)),'dev','--local','--inspector-port','0','--inspector-ip','127.0.0.1','--ip','127.0.0.1','--port',String(workerPort),'--persist-to',state,'--var','ADMIN_MODE:local','--var','ADMIN_ORIGIN:'+origin],{cwd:fileURLToPath(new URL('../backend/',import.meta.url)),env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
 worker.stdout.on('data',x=>logs+=String(x));worker.stderr.on('data',x=>logs+=String(x));
 let ready=false;
 for(let i=0;i<100;i++){
  if(worker.exitCode!==null)throw Error('Worker exited before readiness');
  try{if((await fetch('http://127.0.0.1:'+workerPort+'/api/world')).ok){ready=true;break}}catch{}
  await delay(150);
 }
 assert.ok(ready,'Worker readiness');
 process.env.FA_ADMIN_API_TARGET='http://127.0.0.1:'+workerPort;
 preview=createPreviewServer({subdomains:true});preview.listen(2000,'127.0.0.1');await once(preview,'listening');
 for(const language of ['en','de','es','fr','it'])for(const theme of ['dark','light'])for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},locale:language});
  try{
   await context.addInitScript(({language,theme})=>{localStorage.setItem('football-architect:language',language);localStorage.setItem('football-architect:theme',theme)},{language,theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/settings');await page.locator('[data-admin-login] button').waitFor();
   await page.waitForFunction(()=>!document.querySelector('[data-admin-login] button').disabled);
   assert.equal(await page.locator('#admin-email').getAttribute('autocomplete'),'username');
   assert.equal(await page.locator('#admin-password').getAttribute('autocomplete'),'current-password');
   await page.locator('#admin-email').fill('operator@example.invalid');await page.locator('#admin-password').fill(password);
   await page.locator('#admin-password').press('Enter');await page.locator('[data-admin-signed-in]').waitFor({state:'visible'});
   assert.equal(await page.locator('#admin-password').inputValue(),'');
   if(!preparedWorld){
    await page.waitForFunction(()=>!document.querySelector('[data-admin-prepare]').disabled);
    const completion=page.waitForResponse(r=>r.url().endsWith('/api/admin/seasons/prepare'));
    await page.locator('[data-admin-prepare]').click();
    const result=await completion;assert.equal(result.status(),200);const outcome=await result.json();preparedWorld=outcome.world;
    assert.equal(preparedWorld.seasonNumber,1);assert.equal(preparedWorld.revision,1);assert.equal(preparedWorld.day,0);assert.equal(preparedWorld.phase,'preparing');
   }
   await page.waitForFunction(()=>document.querySelector('[data-admin-world]').textContent.includes('1')&&document.querySelector('[data-admin-prepare]').disabled);
   assert.ok((await page.locator('[data-admin-status]').textContent()).length>0);
   const world=await page.evaluate(()=>fetch('/api/world').then(r=>r.json()));assert.deepEqual(world.world,preparedWorld);
   await page.reload();await page.locator('[data-admin-signed-in]').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.querySelector('[data-admin-prepare]').disabled&&!document.querySelector('[data-admin-refresh]').disabled);
   assert.deepEqual(await page.evaluate(()=>fetch('/api/world').then(r=>r.json())),{world:preparedWorld});
   const secrets=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},cookie:document.cookie}));
   assert.ok(!secrets.includes(password));assert.ok(!secrets.includes('fa_admin_local'));assert.ok(!secrets.includes('csrf'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   assert.deepEqual(errors,[]);
   await page.locator('[data-admin-logout]').click();await page.locator('[data-admin-login]').waitFor({state:'visible'});
   await page.waitForFunction(()=>!document.querySelector('[data-admin-login] button').disabled);
   assert.equal(await page.evaluate(()=>fetch('/api/admin/session').then(r=>r.status)),401);
   checks++;
  }finally{await context.close()}
 }
 const context=await browser.newContext();try{
  const page=await context.newPage();let calls=0;await page.route('**/api/admin/**',route=>{calls++;return route.continue()});await page.goto(origin+'/dashboard');await page.waitForLoadState('networkidle');assert.equal(calls,0,'Public pages must not issue admin calls');
  await page.route('**/api/admin/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"admin_unavailable"}}'}));
  await page.goto(origin+'/settings');await page.waitForFunction(()=>!document.querySelector('[data-admin-login] button').disabled);assert.ok(await page.locator('[data-admin-login]').isVisible());checks++;
 }finally{await context.close()}
 assert.ok(!logs.includes(password));
 console.log(`Admin Settings actual Worker/D1 Chromium PASS: ${checks} cases (5 languages × 2 themes × 3 widths; public independence and API unavailable)`);
}finally{
 delete process.env.FA_ADMIN_API_TARGET;
 if(preview){preview.closeAllConnections();await new Promise(r=>preview.close(r))}
 if(worker&&worker.exitCode===null){const closed=once(worker,'close');worker.kill('SIGTERM');await closed}
 await browser.close();await rm(state,{recursive:true,force:true});
}
