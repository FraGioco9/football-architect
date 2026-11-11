// Dedicated Admin page browser acceptance: no retired Admin password form.
// Real Worker/D1 authorization and rollback are covered by backend Vitest suites.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const playwright=await import(process.env.FA_ADMIN_PLAYWRIGHT||require.resolve('playwright'));
const browser=await playwright[process.env.FA_ADMIN_ENGINE||'chromium'].launch({headless:true,...(process.env.FA_ADMIN_CHROME?{executablePath:process.env.FA_ADMIN_CHROME,args:['--no-sandbox']}: {})});
const preview=createPreviewServer({subdomains:true,devPreview:false});
let checks=0;
try{
 preview.listen(2000,'127.0.0.1');await once(preview,'listening');
 for(const language of ['en','de','es','fr','it'])for(const theme of ['dark','light'])for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},locale:language});
  try{
   await context.addInitScript(({language,theme})=>{
    localStorage.setItem('football-architect:language',language);
    localStorage.setItem('football-architect:theme',theme);
   },{language,theme});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   let adminCalls=0;
   await page.route('**/api/admin/**',async route=>{adminCalls++;return route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"unauthorized"}}'});});
   await page.route('**/api/player/permissions',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"unauthorized"}}'}));
   await page.route('**/api/world',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"world_unavailable"}}'}));
   await page.goto('http://localhost:2000/settings');
   assert.deepEqual(await page.locator('.app-settings-grid h2').allTextContents(),await page.locator('#app-language-heading,#app-theme-heading').allTextContents());
   assert.equal(await page.locator('.app-settings-grid h2').count(),2);
   assert.equal(await page.locator('[data-admin-settings]').count(),0);
   assert.equal(adminCalls,0);
   await page.goto('http://localhost:2000/settings?view=admin');
   assert.equal(await page.locator('.app-settings-grid').isVisible(),true);
   assert.equal(await page.locator('[data-admin-settings]').count(),0);
   assert.equal(adminCalls,0,'The retired Settings query never mounts Admin');
   await page.goto('http://app.localhost:2000/admin/calendar');
   assert.equal(await page.locator('#app-settings').count(),0);
   assert.equal(await page.locator('#app-nav-dashboard.is-active,#app-nav-settings.is-active').count(),0);
   await page.locator('#app-admin[data-admin-access="denied"]').waitFor({state:'attached'});
   assert.equal(await page.locator('#app-admin').isVisible(),false);
   assert.equal(await page.locator('#main-content').innerText(),'');
   assert.equal(await page.locator('[data-admin-signin-link] a').isVisible(),false);
   assert.equal(await page.locator('[data-admin-no-permission]').isVisible(),false);
   assert.equal(await page.locator('#app-nav-admin').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   assert.equal(adminCalls>0,true,'Admin session is checked but never assumed');
   checks++;
  }finally{await context.close();}
 }

 // Permission-gated discoverability and direct access, using synthetic HTTP
 // responses only. No live administrative write is performed by this suite.
 for(const grant of ['denied','read','write','revoked-write','unavailable']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
   let permissions=grant==='denied'?['admin.access']:['admin.access','admin.world.read',...(['write','revoked-write'].includes(grant)?['admin.world.write']:[])];
   let revoked=false,writes=0,permissionReads=0,writeDenied=false,releasePrepare;
   const preparePending=new Promise(resolve=>releasePrepare=resolve);
   let world={schemaVersion:1,generation:'11111111-1111-4111-8111-111111111111',revision:0,seasonNumber:0,day:0,phase:'unstarted'};
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/player/permissions',route=>{
    permissionReads++;
    return route.fulfill({status:revoked?401:grant==='unavailable'?503:200,contentType:'application/json',body:JSON.stringify({permissions:revoked?[]:permissions})});
   });
   await page.route('**/api/world',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.route('**/api/admin/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(revoked)return route.fulfill({status:401,contentType:'application/json',body:'{}'});
    let data;
    if(path==='/api/admin/session')data={actor:{id:'synthetic-admin',email:'admin@example.invalid'},csrfToken:'a'.repeat(64)};
    else if(path==='/api/admin/world')data={world};
    else if(path==='/api/admin/seasons/events')data={world,mode:world.seasonNumber===0?'uninitialized':'legacy',events:[],calendarReady:false};
    else if(path==='/api/admin/seasons/prepare'){
     writes++;assert.ok(['write','revoked-write'].includes(grant));
     if(writeDenied)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:'permission_denied'}})});
     assert.equal(route.request().headers()['x-csrf-token'],'a'.repeat(64));
     assert.deepEqual(route.request().postDataJSON(),{expectedGeneration:world.generation,expectedRevision:world.revision});
     if(grant==='write')await preparePending;
     world={...world,revision:1,seasonNumber:1,phase:'preparing'};data={world};
    }else throw Error('Unexpected Admin request '+path);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   });
   await page.goto('http://app.localhost:2000/settings');
   await page.waitForLoadState('networkidle');
   const allowed=['read','write','revoked-write'].includes(grant);
   assert.equal(await page.locator('#app-nav-admin').count(),allowed?1:0);
   assert.equal(permissionReads,1,'One fresh permission read per public document');
   if(allowed){
    await page.locator('#app-nav-admin').click();await page.waitForURL('**/admin');
    await page.locator('#app-admin[data-admin-access="granted"]').waitFor({state:'visible'});
    await page.locator('[data-admin-card="calendar"]').click();
    await page.waitForURL('**/admin/calendar');
   }else await page.goto('http://app.localhost:2000/admin/calendar');
   await page.waitForLoadState('networkidle');
   assert.equal(await page.locator('[data-admin-signed-in]').isVisible(),allowed);
   assert.equal(await page.locator('#app-admin').isVisible(),allowed);
   if(!allowed)assert.equal(await page.locator('#main-content').innerText(),'');
   assert.equal(await page.locator('#app-nav-admin[aria-current="page"]').count(),allowed?1:0);
   assert.equal(await page.locator('[data-admin-prepare]').isEnabled(),['write','revoked-write'].includes(grant));
   assert.equal(await page.locator('[data-admin-players]').count(),0,'Calendar page contains no Players form');
   assert.equal(writes,0,'Navigation and hydration never mutate the world');
   if(grant==='revoked-write'){
    writeDenied=true;await page.locator('[data-admin-prepare]').click();
    await page.locator('#app-admin[data-admin-access="denied"]').waitFor({state:'attached'});
    assert.equal(await page.locator('#main-content').innerText(),'');
    assert.equal(await page.locator('[data-admin-signed-in]').isVisible(),false);
    assert.equal(await page.locator('#app-nav-admin').count(),0);
    assert.equal(await page.locator('[data-admin-prepare]').isEnabled(),false);
    assert.equal(writes,1);
   }
   if(grant==='write'){
    assert.equal(await page.locator('[data-admin-operations] button:visible').count(),0);
    assert.equal(await page.locator('[data-admin-reset-confirm]').isVisible(),false);
    assert.equal(await page.locator('[data-admin-details]').count(),0);
    await page.locator('[data-admin-prepare]').click();
    try{
     await page.locator('.admin-summary-actions [data-admin-working]').waitFor({state:'visible'});
     assert.equal(await page.locator('[data-admin-status]').isVisible(),false,'Busy feedback does not replace the top message');
    }finally{releasePrepare()}
    await page.waitForFunction(()=>document.querySelector('[data-admin-world]').textContent.includes('Season 1'));
    assert.equal(writes,1);
    assert.equal(await page.locator('[data-admin-command="initialize"]').isEnabled(),true);
    assert.equal(await page.locator('[data-admin-operations] button:visible').count(),1,'Show only the action available now');
    assert.equal(await page.locator('[data-admin-prepare]').isVisible(),false);
    assert.equal(await page.locator('[data-admin-reset-confirm]').isVisible(),true,'Reset is an inline section');
    assert.equal(await page.locator('[data-admin-reset-section]>summary').count(),0);
    assert.equal(await page.locator('[data-admin-working]').isVisible(),false);
    assert.equal(await page.locator('[data-admin-reset]').isEnabled(),false,'Reset still requires its typed confirmation');
   }
   if(allowed&&grant!=='revoked-write'){
    assert.equal(permissionReads,3,'Settings, Admin directory and Calendar each check permissions once');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('[data-admin-world]').isVisible(),true);
    revoked=true;
    if(grant==='write')await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    else await page.locator('[data-admin-refresh]').click();
    await page.locator('#app-admin[data-admin-access="denied"]').waitFor({state:'attached'});
    assert.equal(await page.locator('#main-content').innerText(),'');
    assert.equal(await page.locator('[data-admin-signed-in]').isVisible(),false);
    assert.equal(await page.locator('#app-nav-admin').count(),0,'Revocation removes the Admin link');
    assert.equal(await page.locator('[data-admin-prepare]').isEnabled(),false);
   }
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close();}
 }

 // Admin directory and Players are permission checked but do not call the World Admin API.
 for(const permissionSet of [[],['admin.access','admin.world.read'],['admin.access','admin.world.read','admin.world.write']]){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
   const page=await context.newPage(),errors=[];let adminCalls=0,permissionReads=0;
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/player/permissions',route=>{permissionReads++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({permissions:permissionSet})})});
   await page.route('**/api/admin/**',route=>{adminCalls++;return route.fulfill({status:503,body:'not allowed'})});
   await page.goto('http://app.localhost:2000/admin');
   await page.locator('#app-admin[data-admin-access="'+(permissionSet.includes('admin.world.read')?'granted':'denied')+'"]').waitFor({state:'attached'});
   if(permissionSet.includes('admin.world.read')){
    const widths=await page.evaluate(()=>{const main=document.querySelector('#main-content'),view=document.querySelector('#app-admin'),css=getComputedStyle(main);
     return {available:main.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight),actual:view.getBoundingClientRect().width}});
    assert.ok(Math.abs(widths.available-widths.actual)<=2,JSON.stringify(widths));
   }
   const writer=permissionSet.includes('admin.world.write');
   if(permissionSet.length===0)assert.equal(await page.locator('#main-content').innerText(),'');
   else{
    assert.equal(await page.locator('.admin-directory-card').count(),2);
    assert.equal(await page.locator('[data-admin-card="calendar"].app-link').isVisible(),true);
    assert.equal(await page.locator('[data-admin-card="players"].app-link').isVisible(),writer);
    assert.equal(await page.locator('[data-admin-panel="players"]').isVisible(),writer);
    assert.equal(await page.locator('#app-nav-dashboard.is-active,#app-nav-divisions.is-active').count(),0);
   }
   await page.goto('http://app.localhost:2000/admin/players');
   await page.locator('#app-admin[data-admin-access="'+(writer?'granted':'denied')+'"]').waitFor({state:'attached'});
   if(writer){
    assert.equal(await page.locator('#app-nav-dashboard.is-active,#app-nav-divisions.is-active').count(),0);
    const formWidth=await page.evaluate(()=>{const form=document.querySelector('[data-admin-players-form]'),panel=document.querySelector('[data-admin-players] .app-settings-panel-content');
     const styles=getComputedStyle(panel);return {available:panel.clientWidth-parseFloat(styles.paddingLeft)-parseFloat(styles.paddingRight),actual:form.getBoundingClientRect().width}});
    assert.ok(Math.abs(formWidth.available-formWidth.actual)<=2,JSON.stringify(formWidth));
    const panelWidth=await page.evaluate(()=>{const view=document.getElementById('app-admin'),panel=document.querySelector('[data-admin-players]');
     return {view:view.getBoundingClientRect().width,panel:panel.getBoundingClientRect().width}});
    assert.ok(Math.abs(panelWidth.view-panelWidth.panel)<=2,'Players panel must span full width: '+JSON.stringify(panelWidth));
    const back=page.locator('[data-admin-back]');
    assert.equal(await back.getAttribute('href'),'/admin');
    assert.ok((await back.getAttribute('class')).includes('app-link'));
    const label=page.locator('[data-players-option="age"]').locator('xpath=..');
    const beforeFocus=await label.evaluate(node=>({bg:getComputedStyle(node).backgroundColor,outline:getComputedStyle(node).outlineStyle}));
    await page.locator('[data-players-option="age"]').focus();
    const afterFocus=await label.evaluate(node=>({bg:getComputedStyle(node).backgroundColor,outline:getComputedStyle(node).outlineStyle}));
    assert.deepEqual(afterFocus,beforeFocus,'Label highlight must not change when the input box is focused');
    const focused=await page.locator('[data-players-option="age"]').evaluate(node=>({border:getComputedStyle(node).borderColor,shadow:getComputedStyle(node).boxShadow}));
    assert.notEqual(focused.shadow,'none','Focus highlight must remain visible on the input box');
    assert.equal(await page.locator('[data-players-option="count"]').inputValue(),'');
    assert.equal(await page.locator('[data-players-option="seed"]').inputValue(),'');
    assert.equal(await page.locator('[data-players-option="primarySuitability"]').inputValue(),'');
    const empty=await page.locator('[data-admin-players-command]').innerText();
    assert.match(empty,/--options-base64 e30 --out/);
    assert.equal(await page.locator('[data-players-dropdown="primaryNationality"] .language-trigger').getAttribute('aria-expanded'),'false');
    await page.locator('[data-players-dropdown="primaryNationality"] .language-trigger').click();
    assert.equal(await page.locator('[data-players-dropdown="primaryNationality"] .language-trigger').getAttribute('aria-expanded'),'true');
    await page.locator('[data-players-dropdown="primaryNationality"] .admin-players-dropdown-search').fill('Italy');
    await page.locator('[data-players-dropdown="primaryNationality"] .language-option[data-menu-value="ITA"]').click();
    assert.equal(await page.locator('[data-players-option="primaryNationality"]').inputValue(),'ITA');
    await page.locator('[data-players-dropdown="primaryPosition"] .language-trigger').click();
    await page.locator('[data-players-dropdown="primaryPosition"] .language-option[data-menu-value="ST"]').click();
    assert.equal(await page.locator('[data-players-option="primaryPosition"]').inputValue(),'ST');
    await page.locator('[data-players-option="count"]').fill('2');
    await page.locator('[data-players-option="seed"]').fill('admin-trial');
    await page.locator('[data-players-option="age"]').fill('18');
    await page.locator('[data-players-option="attribute.shooting"]').fill('65:80');
    const command=await page.locator('[data-admin-players-command]').innerText();
    const packed=command.match(/--options-base64 ([A-Za-z0-9_-]+)/)?.[1];
    assert.ok(packed);
    const options=JSON.parse(Buffer.from(packed,'base64url').toString('utf8'));
    assert.equal(options.count,2);assert.equal(options.seed,'admin-trial');
    assert.equal(options.primaryNationality,'ITA');assert.equal(options.primaryPosition,'ST');
    assert.deepEqual(options.attributes.shooting,[65,80]);assert.equal(options.age,18);
    await page.locator('[data-players-option="age"]').fill('20');
    assert.equal(await page.locator('[data-admin-players-copy]').isEnabled(),false);
    await page.locator('[data-players-option="age"]').fill('18');
    assert.equal(await page.locator('[data-admin-players-copy]').isEnabled(),true);
   }else assert.equal(await page.locator('#main-content').innerText(),'');
   assert.equal(permissionReads,2);
   assert.equal(adminCalls,0,'Directory and Players cannot invoke World Admin endpoints');
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close()}
 }
 // Destination-day preview updates after the simulated command's authoritative
 // response. This is an isolated HTTP fixture, never a remote world mutation.
 {
  const context=await browser.newContext();
  try{
   let world={schemaVersion:1,generation:'11111111-1111-4111-8111-111111111111',revision:20,seasonNumber:1,day:15,phase:'active'},stale=false,writes=0,pendingActions=[];
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/player/permissions',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({permissions:['admin.access','admin.world.read','admin.world.write']})}));
   await page.route('**/api/world',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.route('**/api/admin/**',async route=>{
    const path=new URL(route.request().url()).pathname;let payload;
    if(path==='/api/admin/session')payload={actor:{id:'preview-admin',email:'preview@example.invalid'},csrfToken:'a'.repeat(64)};
    else if(path==='/api/admin/world')payload={world};
    else if(path==='/api/admin/seasons/events')payload={world:stale?{...world,revision:world.revision-1}:world,mode:'sporting',events:pendingActions,calendarReady:true};
    else if(path==='/api/admin/seasons/advance'){
     assert.deepEqual(route.request().postDataJSON(),{expectedGeneration:world.generation,expectedRevision:world.revision});
     writes++;world={...world,day:world.day+1,revision:world.revision+1};payload={world};
    }else throw Error('Unexpected preview request '+path);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
   });
   await page.goto('http://app.localhost:2000/admin/calendar');
   const preview=page.locator('[data-admin-next-day]');await preview.waitFor({state:'visible'});
   assert.ok((await preview.innerText()).includes('day 16: I-1 · D-4'));
   assert.equal(await page.locator('[data-admin-details],[data-admin-reschedule-section]').count(),0);
   assert.equal(writes,0);
   pendingActions=[{id:'pending-today',kind:'draw-international',status:'scheduled',day:15,order:1}];
   await page.locator('[data-admin-refresh]').click();await preview.waitFor({state:'hidden'});
   assert.equal(await page.locator('[data-admin-command="advance"]').isEnabled(),false);
   assert.equal(writes,0);
   pendingActions=[];await page.locator('[data-admin-refresh]').click();await preview.waitFor({state:'visible'});
   await page.locator('[data-admin-command="advance"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-admin-next-day]').textContent.includes('day 17: D-5'));
   assert.equal(writes,1);
   world={...world,day:31,revision:world.revision+1};await page.locator('[data-admin-refresh]').click();
   await page.waitForFunction(()=>document.querySelector('[data-admin-next-day]').textContent.includes('day 32: No matches'));
   stale=true;await page.locator('[data-admin-refresh]').click();await preview.waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close()}
 }
 const context=await browser.newContext();
 try{
  const page=await context.newPage();let adminCalls=0;const pending=new Set();
  page.on('request',request=>pending.add(request.url()));page.on('requestfinished',request=>pending.delete(request.url()));page.on('requestfailed',request=>pending.delete(request.url()));
  await page.route('**/api/admin/**',route=>{adminCalls++;return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"admin_unavailable"}}'});});
  await page.route('**/api/world',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"world_unavailable"}}'}));
  await page.goto('http://localhost:2000/dashboard');
  try{await page.waitForLoadState('networkidle')}catch(error){console.error('Anonymous dashboard pending requests: '+JSON.stringify([...pending]));throw error}
  assert.equal(adminCalls,0,'Anonymous public browsing must not invoke Admin APIs');
  assert.equal(await page.evaluate(()=>window.faWorldState?.get().current),null,'Unavailable world data must not fabricate current progress');
  checks++;
 }finally{await context.close();}
 console.log('Dedicated Admin page browser contracts PASS: '+checks+' cases');
}finally{
 preview.closeAllConnections();await new Promise(resolve=>preview.close(resolve));
 await browser.close();
}
