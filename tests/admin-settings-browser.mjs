// Dedicated Admin page browser acceptance: no retired Admin password form.
// Real Worker/D1 authorization and rollback are covered by backend Vitest suites.
import assert from 'node:assert/strict';
import {createBrowserTiming} from '../tools/ci-browser-timing.mjs';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const playwright=await import(process.env.FA_ADMIN_PLAYWRIGHT||require.resolve('playwright'));
const timing=createBrowserTiming('admin-settings',process.env.FA_ADMIN_ENGINE||'chromium');
const browser=await playwright[process.env.FA_ADMIN_ENGINE||'chromium'].launch({headless:true,...(process.env.FA_ADMIN_CHROME?{executablePath:process.env.FA_ADMIN_CHROME,args:['--no-sandbox']}: {})});
timing.mark('browser-ready');
const preview=createPreviewServer({subdomains:true,devPreview:false});
let checks=0;
try{
 preview.listen(2000,'127.0.0.1');await once(preview,'listening');timing.mark('preview-ready');
 for(const language of ['en','de','es','fr','it'])for(const theme of ['dark','light'])for(const width of [320,390,768,1440]){
  const contextStart=timing.now();
  const context=await browser.newContext({viewport:{width,height:900},locale:language});
  try{
   await context.addInitScript(({language,theme})=>{
    localStorage.setItem('football-architect:language',language);
    localStorage.setItem('football-architect:theme',theme);
   },{language,theme});
   const page=await context.newPage(),errors=[];
   timing.sample('context-page-ready',timing.now()-contextStart);
   page.on('pageerror',e=>errors.push(e.message));
   let adminCalls=0;
   await page.route('**/api/admin/**',async route=>{adminCalls++;return route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"unauthorized"}}'});});
   await page.route('**/api/player/permissions',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"unauthorized"}}'}));
   await page.route('**/api/world',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"world_unavailable"}}'}));
   const routeStart=timing.now();
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
   timing.sample('denied-route-sequence-ready',timing.now()-routeStart);
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

 timing.mark('denied-matrix-complete');
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
    assert.equal(permissionReads,1,'Settings, Admin directory and Calendar reuse one per-tab permissions check');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('[data-admin-world]').isVisible(),true);
    revoked=true;
    await page.locator('[data-admin-refresh]').click();
    await page.locator('#app-admin[data-admin-access="denied"]').waitFor({state:'attached'});
    assert.equal(await page.locator('#main-content').innerText(),'');
    assert.equal(await page.locator('[data-admin-signed-in]').isVisible(),false);
    assert.equal(await page.locator('#app-nav-admin').count(),0,'Revocation removes the Admin link');
    assert.equal(await page.locator('[data-admin-prepare]').isEnabled(),false);
   }
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close();}
 }

 timing.mark('permissions-matrix-complete');
  // Admin directory and Players are permission checked but do not call the World Admin API.
 for(const permissionSet of [[],['admin.access','admin.world.read'],['admin.access','admin.world.read','admin.world.write']]){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
   const page=await context.newPage(),errors=[];let adminCalls=0,permissionReads=0,previewCalls=0,commitCalls=0,sessionReads=0;
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/player/permissions',route=>{permissionReads++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({permissions:permissionSet})})});
   await page.route('**/api/admin/**',route=>{adminCalls++;return route.fulfill({status:503,body:'not allowed'})});
   // An isolated API fixture; the real Worker/D1 transactions are tested separately.
   await page.route('**/api/admin/session',route=>{sessionReads++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({actor:{id:'admin'},csrfToken:'fixture-csrf'})})});
   let currentOptions=null,draftCommitted=false;
   await page.route('**/api/admin/players/preview',route=>{
    previewCalls++;
    assert.equal(route.request().headers()['x-csrf-token'],'fixture-csrf');
    const {options}=route.request().postDataJSON();
    currentOptions=options;draftCommitted=false;
    assert.equal(options.count,2);
    assert.equal(options.seed,'admin-trial','Explicit generator seed stays unchanged after saving');
    assert.equal(options.primaryNationality,'ITA');assert.equal(options.primaryPosition,'ST');
    assert.deepEqual(options.attributes.shooting,[65,80]);assert.equal(options.age,18);
    const candidates=[0,1].map(i=>({preview_id:'trial-000'+(i+1),
     display_name:'Luca '+(i?'Bianchi':'Rossi'),nationality:'ITA',age:18,initial_age:18,
     primary_position:'ST',secondary_positions:i?['RW']:[],preferred_foot:'right',height_cm:180,
     attributes:{speed:60,strength:60,stamina:60,agility:60,passing:60,technique:60,dribbling:60,
      shooting:70,crossing:60,tackling:60,marking:60,heading:60,vision:60,positioning:60,
      decisions:60,composure:60,gk_reflexes:60,gk_handling:60,gk_positioning:60,gk_aerial:60}}));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draftId:'11111111-1111-4111-8111-111111111111',
     summary:{count:2,seed:options.seed,countries:{ITA:2}},candidates})});
   });
   await page.route('**/api/admin/players/draft',route=>{
    assert.equal(route.request().method(),'POST','Admin draft read must be CSRF-protected');
    assert.equal(route.request().headers()['x-csrf-token'],'fixture-csrf');
    assert.deepEqual(route.request().postDataJSON(),{draftId:'11111111-1111-4111-8111-111111111111'});
    assert.ok(currentOptions,'Preview must have been generated before it can be read');
    const candidates=[0,1].map(i=>({preview_id:'trial-000'+(i+1),
     display_name:'Luca '+(i?'Bianchi':'Rossi'),nationality:'ITA',age:18,initial_age:18,
     primary_position:'ST',secondary_positions:i?['RW']:[],preferred_foot:'right',height_cm:180,
     attributes:{speed:60,strength:60,stamina:60,agility:60,passing:60,technique:60,dribbling:60,
      shooting:70,crossing:60,tackling:60,marking:60,heading:60,vision:60,positioning:60,
      decisions:60,composure:60,gk_reflexes:60,gk_handling:60,gk_positioning:60,gk_aerial:60}}));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     draftId:'11111111-1111-4111-8111-111111111111',status:draftCommitted?'committed':'preview',summary:{count:2,seed:currentOptions.seed,countries:{ITA:2}},
     options:currentOptions,candidates})});
   });
   await page.route('**/api/admin/players/commit',route=>{
    commitCalls++;draftCommitted=true;assert.equal(route.request().headers()['x-csrf-token'],'fixture-csrf');
    assert.deepEqual(route.request().postDataJSON(),{draftId:'11111111-1111-4111-8111-111111111111',confirmation:'GENERATE PLAYERS'});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({batchId:'11111111-1111-4111-8111-111111111111',count:2,alreadyCommitted:false})});
   });
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
    assert.equal(await page.locator('.admin-directory-card').count(),5);
    assert.equal(await page.locator('[data-admin-card="calendar"].app-link').isVisible(),true);
    assert.equal(await page.locator('[data-admin-card="players"].app-link').isVisible(),writer);
    assert.equal(await page.locator('[data-admin-card="contracts"].app-link').isVisible(),writer);
     assert.equal(await page.locator('[data-admin-card="licenses"].app-link').isVisible(),writer);
    assert.equal(await page.locator('[data-admin-card="rewards"].app-link').isVisible(),true);
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
    // Compare the rendered Admin title against the site's direct-child page title.
    const titleTypography=await page.evaluate(()=>{
     const current=document.getElementById('admin-title');
     const reference=document.createElement('section');reference.className='app-view';
     const title=document.createElement('h1');title.className='app-page-title';title.textContent='Reference';
     reference.append(title);document.body.append(reference);
     const sample=node=>{const css=getComputedStyle(node);return {fontSize:css.fontSize,fontWeight:css.fontWeight,letterSpacing:css.letterSpacing,lineHeight:css.lineHeight,color:css.color,textAlign:css.textAlign}};
     const result={actual:sample(current),expected:sample(title)};reference.remove();return result;
    });
    assert.deepEqual(titleTypography.actual,titleTypography.expected,'Players h1 must exactly match the standard page title');
    const back=page.locator('[data-admin-back]');
    assert.equal(await back.getAttribute('href'),'/admin');
    assert.ok((await back.getAttribute('class')).includes('app-link'));
    assert.equal(await page.locator('[data-admin-players-label="intro"],[data-players-seed-help]').count(),0,'Removed intro and seed note stay absent');
    const label=page.locator('[data-players-option="age"]').locator('xpath=..');
    const readLabel=()=>label.evaluate(node=>{
     const span=node.querySelector('[data-admin-players-label]'),css=getComputedStyle(node),caption=getComputedStyle(span);
     return {bg:css.backgroundColor,outline:css.outlineStyle,shadow:css.boxShadow,tap:css.webkitTapHighlightColor,
      textColor:caption.color,textBackground:caption.backgroundColor,textOutline:caption.outlineStyle,textShadow:caption.boxShadow};
    });
    const beforeFocus=await readLabel();
    const age=page.locator('[data-players-option="age"]');
    await page.mouse.move(0,0); // Establish an unhovered field baseline.
    await page.waitForTimeout(220);
    const inputBeforeHover=await age.evaluate(node=>({bg:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderColor}));
    // Captions deliberately ignore pointer events; hover() would wait for a hit target forever.
    const captionBox=await page.locator('[data-admin-players-label="age"]').boundingBox();
    assert.ok(captionBox,'The age caption must be laid out');
    await page.mouse.move(captionBox.x+captionBox.width/2,captionBox.y+captionBox.height/2);
    await page.waitForTimeout(220);
    assert.deepEqual(await readLabel(),beforeFocus,'Hover on field caption must not highlight the label');
    const inputAfterCaption=await age.evaluate(node=>({bg:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderColor}));
    assert.deepEqual(inputAfterCaption,inputBeforeHover,'Hover on the caption must not highlight the input box either');
    // Native HTML <label> can forward :hover to its associated input.
    // The visible highlight belongs to the field box, never the caption.
    await age.hover();
    await page.waitForTimeout(220);
    assert.deepEqual(await readLabel(),beforeFocus,'Hover on input box must leave label unchanged');
    const inputAfterHover=await age.evaluate(node=>({bg:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderColor}));
    assert.notDeepEqual(inputAfterHover,inputBeforeHover,'Only the editable field box should highlight on hover');

    await page.locator('[data-players-option="age"]').focus();
    const afterFocus=await readLabel();
    assert.deepEqual(afterFocus,beforeFocus,'Label and label text must remain unchanged on input focus');
    const focused=await page.locator('[data-players-option="age"]').evaluate(node=>({border:getComputedStyle(node).borderColor,shadow:getComputedStyle(node).boxShadow}));
    assert.notEqual(focused.shadow,'none','Focus highlight must remain visible on the input box');
    assert.equal(await page.locator('[data-players-option="count"]').inputValue(),'');
    assert.equal(await page.locator('[data-players-option="seed"]').inputValue(),'');
    assert.equal(await page.locator('[data-players-option="primarySuitabilityMin"]').inputValue(),'');
    assert.equal(await page.locator('[data-players-option="primarySuitabilityMax"]').inputValue(),'');
    assert.equal(await page.locator('[data-admin-players-copy],[data-admin-players-command]').count(),0,'No legacy CLI-only form controls');
    assert.equal(await page.locator('[data-admin-players-result],[data-admin-players-commit]').count(),0,'The generator must not embed preview or approval');
    assert.equal(await page.locator('[data-players-dropdown="primaryNationality"] .language-trigger').getAttribute('aria-expanded'),'false');
    await page.locator('[data-players-dropdown="primaryNationality"] .language-trigger').click();
    assert.equal(await page.locator('[data-players-dropdown="primaryNationality"] .language-trigger').getAttribute('aria-expanded'),'true');
    await page.locator('[data-players-dropdown="primaryNationality"] .admin-players-dropdown-search').fill('Italy');
    await page.locator('[data-players-dropdown="primaryNationality"] .language-option[data-menu-value="ITA"]').click();
    assert.equal(await page.locator('[data-players-option="primaryNationality"]').inputValue(),'ITA');
    await page.locator('[data-players-dropdown="primaryPosition"] .language-trigger').click();
    await page.locator('[data-players-dropdown="primaryPosition"] .language-option[data-menu-value="ST"]').click();
    await page.locator('[data-players-option="count"]').fill('2');
    await page.locator('[data-players-option="seed"]').fill('admin-trial');
    await page.locator('[data-players-option="age"]').fill('18');
    await page.locator('[data-players-option="attribute.shooting"]').fill('65:80');
    assert.equal(await page.locator('[data-admin-players-preview]').isEnabled(),true);
    await page.locator('[data-admin-players-preview]').click();
    await page.waitForURL(url=>new URL(url).pathname==='/admin/players/preview');
    await page.locator('[data-admin-players-preview-page]').waitFor({state:'visible'});
    await page.locator('[data-admin-preview-rows] tr:not(.app-players-loading-row)').first().waitFor({state:'visible'});
    assert.equal(await page.locator('[data-admin-preview-rows] tr').count(),2);
    assert.match(await page.locator('[data-admin-preview-count]').innerText(),/2/);
    assert.equal(await page.locator('.app-players-preview-page .app-panel,.app-players-preview-page .admin-players-approval').count(),0);
    assert.equal(await page.locator('.app-players-preview-actions > :is(button,a)').count(),3);
    assert.equal(await page.locator('.app-players-preview-actions [data-admin-players-feedback]').count(),1);
    assert.equal(await page.locator('.app-players-preview-actions [data-admin-players-commit-status]').count(),1);
    assert.equal(await page.locator('[data-admin-players-commit]').isEnabled(),true,'Generate opens confirmation rather than saving immediately');
    assert.equal(await page.locator('[data-admin-players-form]').count(),0,'The dedicated preview contains no generator form');
    assert.equal(await page.locator('[data-admin-preview-rows] a').count(),2,'Each preview candidate has a protected temporary detail link');
    assert.match(await page.locator('[data-admin-preview-rows] a').first().getAttribute('href'),/^\/admin\/players\/preview\/player\?draftId=.*&index=1(?:&|$)/);

    // A draft candidate opens a real protected detail, never a public ID.
    await page.locator('[data-admin-preview-view="attributes"]').click();
    await page.locator('[data-admin-preview-group="mental"]').click();
    await page.locator('[data-admin-preview-rows] a').first().click();
    await page.waitForURL(url=>new URL(url).pathname==='/admin/players/preview/player');
    await page.locator('[data-player-detail-mode="preview"]').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-detail-name]').innerText(),'Luca Rossi');
    assert.equal(await page.locator('[data-detail-back]').getAttribute('href').then(href=>new URL(href,'http://app.localhost:2000').pathname),'/admin/players/preview');
    assert.equal(await page.locator('[data-player-detail-mode="preview"] .app-panel').count(),3,'Two Overview panels plus dedicated Info view');
    assert.equal(await page.locator('[data-detail-panel="overview"] .app-panel').count(),2,'Overview has Positions and Attributes side by side');
    assert.equal(await page.locator('[data-detail-positions] > h2').innerText(),'Positions');
    assert.equal(await page.locator('[data-detail-positions] .app-player-detail-pitch').count(),1);
    assert.equal(await page.locator('[data-detail-positions] dl').count(),0,'No textual position list in the pitch panel');
    assert.equal(await page.locator('[data-detail-status]').isVisible(),false,'No loading caption when the profile resolves');
    const detailMetrics=await page.evaluate(()=>{
     const panel=document.querySelector('[data-detail-positions]').getBoundingClientRect();
     const attrs=document.querySelector('.app-player-detail-attributes').getBoundingClientRect();
     const pitch=document.querySelector('.app-player-detail-pitch-holder').getBoundingClientRect();
     const label=document.querySelector('.app-player-detail-attributes h2');
     const rows=[...document.querySelectorAll('[data-detail-attribute-group="technical"] .app-player-detail-attribute-line')];
     return {panelWidth:panel.width,pitchWidth:pitch.width,pitchCenter:(pitch.left+pitch.right)/2,
      panelCenter:(panel.left+panel.right)/2,topDifference:Math.abs(panel.top-attrs.top),
      panelBottom:panel.bottom,attributesTop:attrs.top,
      headingFontSize:getComputedStyle(label).fontSize,
      firstDivider:getComputedStyle(rows[0]).borderBottomWidth,lastDivider:getComputedStyle(rows.at(-1)).borderBottomWidth};
    });
    assert.ok(detailMetrics.pitchWidth>0&&detailMetrics.pitchWidth<=330,'Pitch fits reserved responsive width');
    assert.ok(detailMetrics.pitchWidth<=detailMetrics.panelWidth,'Pitch cannot overflow its panel');
    assert.ok(Math.abs(detailMetrics.pitchCenter-detailMetrics.panelCenter)<3,'Pitch centered horizontally');
    // This fixture uses a 390px viewport: mobile Overview panels stack vertically.
    assert.ok(detailMetrics.attributesTop>=detailMetrics.panelBottom-2,
      'Mobile Positions and Attributes stack without overlap');
    await page.setViewportSize({width:1280,height:900});
    const desktopTopDifference=await page.evaluate(()=>{
     const positions=document.querySelector('[data-detail-positions]').getBoundingClientRect();
     const attributes=document.querySelector('.app-player-detail-attributes').getBoundingClientRect();
     return Math.abs(positions.top-attributes.top);
    });
    assert.ok(desktopTopDifference<2,'Desktop Positions and Attributes share their top row');
    await page.setViewportSize({width:390,height:844});
    assert.equal(detailMetrics.headingFontSize,'22px');
    assert.equal(detailMetrics.firstDivider,'1px');
    assert.equal(detailMetrics.lastDivider,'0px');
    assert.equal(await page.locator('[data-detail-value]').count(),5,'Info contains five personal facts');
    assert.equal(await page.locator('[data-detail-attr-value]').count(),20,'Attributes contains 20 numeric skills');
    assert.equal(await page.locator('[data-detail-attribute-group]').count(),4,'Four skill columns');
    assert.equal(await page.locator('[data-detail-pitch-markers] .app-player-detail-pitch-marker').count(),1,'Primary position is marked');
    assert.equal(await page.locator('[data-detail-view="overview"]').getAttribute('aria-selected'),'true');
    for(const name of ['stats','history','progression'])assert.equal(await page.locator('[data-detail-view="'+name+'"]').isDisabled(),true);
    assert.match(await page.locator('[data-detail-attr-value="shooting"]').innerText(),/^(?:[0-9]{1,2}|—)$/);
    await page.locator('[data-detail-view="info"]').click();
    assert.equal(await page.locator('[data-detail-panel="info"]').isVisible(),true);
    assert.equal(await page.locator('[data-detail-panel="overview"]').isVisible(),false);
    assert.equal(new URL(page.url()).searchParams.get('view'),'info');
    assert.equal((await page.locator('[data-detail-value="nationality"]').innerText()).trim(),'Italy','Nationality presents its full localized name, not the code');
    await page.goBack();
    assert.equal(await page.locator('[data-detail-panel="overview"]').isVisible(),true,'Browser Back restores Overview');
    assert.equal(await page.locator('[data-detail-view="overview"]').getAttribute('aria-selected'),'true');
    await page.locator('[data-detail-back]').click();
    await page.waitForURL(url=>new URL(url).pathname==='/admin/players/preview');
    await page.locator('[data-admin-preview-rows] tr:not(.app-players-loading-row)').first().waitFor({state:'visible'});
    assert.equal(await page.locator('[data-admin-preview-view="attributes"]').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('[data-admin-preview-group="mental"]').getAttribute('aria-selected'),'true');
    await page.locator('[data-admin-preview-view="overview"]').click();

    // Pairwise responsive/i18n checks in the existing Chromium + WebKit Admin
    // browser suite. Preview data is already loaded: no additional API reads.
    const previewCases=[
     {lang:'en',width:320,theme:'dark',generate:'Generate',overview:'Overview',attributes:'Attributes'},
     {lang:'it',width:390,theme:'light',generate:'Genera',overview:'Panoramica',attributes:'Attributi'},
     {lang:'de',width:430,theme:'dark',generate:'Generieren',overview:'Übersicht',attributes:'Attribute'},
     {lang:'es',width:768,theme:'light',generate:'Generar',overview:'Resumen',attributes:'Atributos'},
     {lang:'fr',width:1440,theme:'dark',generate:'Générer',overview:'Vue d’ensemble',attributes:'Attributs'}
    ];
    for(const variant of previewCases){
     await page.setViewportSize({width:variant.width,height:844});
     await page.evaluate(({lang,theme})=>{
      document.documentElement.lang=lang;document.documentElement.dataset.theme=theme;
     },variant);
     await page.waitForFunction(expected=>document.querySelector('[data-admin-players-commit]')?.textContent===expected,variant.generate);
     assert.equal(await page.locator('[data-admin-preview-view="overview"]').innerText(),variant.overview);
     assert.equal(await page.locator('[data-admin-preview-view="attributes"]').innerText(),variant.attributes);
     const layout=await page.evaluate(()=>{
      const root=document.querySelector('[data-admin-players-preview-page]');
      const bar=root.querySelector('.app-players-preview-actions');
      const scroll=root.querySelector('.app-players-table-scroll');
      const nav=root.querySelector('[data-admin-preview-pagination]');
      // The fixture has two players: expose the shared pager only to measure
      // actual CSS geometry, then restore its original hidden state.
      const originallyHidden=nav.hidden;nav.hidden=false;
      const left=nav.querySelector('[data-admin-preview-prev]').getBoundingClientRect();
      const right=nav.querySelector('[data-admin-preview-next]').getBoundingClientRect();
      const widths={previous:left.width,next:right.width,heightPrev:left.height,heightNext:right.height};
      nav.hidden=originallyHidden;
      return {
       viewport:innerWidth,document:document.documentElement.scrollWidth,
       actions:[...bar.querySelectorAll(':scope > button,:scope > a')].map(node=>({
        text:node.textContent.trim(),visible:node.getBoundingClientRect().width>0,
        right:node.getBoundingClientRect().right
       })),
       tableViewport:scroll.getBoundingClientRect().width,
       widths
      };
     });
     assert.ok(layout.document<=layout.viewport+1,variant.lang+' '+variant.width+' page overflow: '+JSON.stringify(layout));
     assert.equal(layout.actions.length,3,'Only Generate, Regenerate and Back may appear');
     assert.ok(layout.actions.every(x=>x.visible&&x.right<=layout.viewport+1),'Visible actions must fit the viewport: '+JSON.stringify(layout));
     assert.ok(layout.tableViewport>0&&layout.tableViewport<=layout.viewport+1,'Only the table may scroll horizontally');
     assert.ok(Math.abs(layout.widths.previous-layout.widths.next)<.5,'Previous/Next widths must match');
     assert.ok(Math.abs(layout.widths.heightPrev-layout.widths.heightNext)<.5,'Previous/Next heights must match');
     assert.equal(layout.widths.previous,variant.width<=420?88:112,'Shared pager width at this breakpoint');
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{document.documentElement.lang='en';document.documentElement.dataset.theme='dark'});
    await page.waitForFunction(()=>document.querySelector('[data-admin-players-commit]')?.textContent==='Generate');
    await page.locator('[data-admin-preview-rows] .app-players-nationality-flag').first().hover();
    await page.locator('#app-players-nationality-tooltip').waitFor({state:'visible'});
    assert.match(await page.locator('#app-players-nationality-tooltip').innerText(),/Italy/);
    assert.equal(await page.locator('#app-players-nationality-tooltip').getAttribute('data-placement'),'above');
    assert.equal(await page.locator('#app-players-nationality-tooltip').evaluate(node=>getComputedStyle(node).animationName),'app-world-tooltip-in');
    await page.mouse.move(0,0);
    await page.locator('[data-admin-preview-rows] .app-players-nationality-flag').first().focus();
    await page.locator('#app-players-nationality-tooltip').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.locator('#app-players-nationality-tooltip').waitFor({state:'hidden'});
    await page.locator('[data-admin-preview-view="attributes"]').click();
    await page.locator('[data-admin-preview-group="technical"]').click();
    assert.equal(await page.locator('[data-admin-preview-group="technical"]').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('[data-admin-preview-rows] tr').count(),2);
    assert.equal(await page.locator('[data-admin-preview-rows] tr:first-child td').count(),11,'Technical has 8 attributes plus flag/name/positions');
    await page.locator('[data-admin-preview-view="overview"]').click();
    await page.locator('[data-admin-preview-back]').click();
    await page.waitForURL(url=>new URL(url).pathname==='/admin/players');
    await page.locator('[data-players-option="age"]').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-players-option="count"]').inputValue(),'2','Back restores all generator options');
    assert.equal(await page.locator('[data-players-option="seed"]').inputValue(),'admin-trial');
    assert.equal(await page.locator('[data-players-option="primaryNationality"]').inputValue(),'ITA');
    assert.equal(await page.locator('[data-players-option="primaryPosition"]').inputValue(),'ST');
    assert.equal(await page.locator('[data-players-option="attribute.shooting"]').inputValue(),'65:80');
    await page.locator('[data-players-option="age"]').fill('20');
    assert.equal(await page.locator('[data-admin-players-preview]').isEnabled(),false,'Invalid generation options cannot be previewed');
    await page.locator('[data-players-option="age"]').fill('18');
    await page.locator('[data-admin-players-preview]').click();
    await page.waitForURL(url=>new URL(url).pathname==='/admin/players/preview');
    await page.locator('[data-admin-preview-rows] tr:not(.app-players-loading-row)').first().waitFor({state:'visible'});
    await page.locator('[data-admin-players-commit]').click();
    await page.locator('[data-admin-preview-confirm-dialog]').waitFor({state:'visible'});
    assert.equal(commitCalls,0,'Opening confirmation never saves players');
    await page.keyboard.press('Escape');
    await page.locator('[data-admin-preview-confirm-dialog]').waitFor({state:'hidden'});
    assert.equal(commitCalls,0,'Closing the confirmation cannot save a player');
    await page.locator('[data-admin-players-commit]').click();
    await page.locator('[data-admin-preview-confirm-dialog]').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-admin-preview-confirm-action]').isEnabled(),false);
    await page.locator('[data-admin-players-confirmation]').fill('GENERATE PLAYERS');
    assert.equal(await page.locator('[data-admin-preview-confirm-action]').isEnabled(),true);
    await page.locator('[data-admin-preview-confirm-action]').click();
    await page.locator('[data-admin-players-commit-status]').waitFor({state:'visible'});
    assert.match(await page.locator('[data-admin-players-commit-status]').innerText(),/2/);
    assert.equal(await page.locator('[data-admin-players-commit]').isEnabled(),false,'Approved preview cannot be committed twice');
    assert.equal(await page.locator('[data-admin-preview-confirm-dialog]').isVisible(),false,'Committed draft must close the confirmation');
    await page.locator('[data-admin-preview-back]').click();
    await page.waitForURL(url=>new URL(url).pathname==='/admin/players');
    await page.locator('[data-players-option="count"]').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-players-option="count"]').inputValue(),'2','Saving does not erase the prior generator settings');
    assert.equal(await page.locator('[data-players-option="primaryNationality"]').inputValue(),'ITA');
    assert.equal(await page.locator('[data-players-option="seed"]').inputValue(),'admin-trial','Manually selected seed remains unchanged after saving');
    assert.equal(await page.locator('[data-admin-players-preview]').isEnabled(),true,'Next cohort is immediately previewable');
    await page.locator('[data-admin-players-preview]').click();
    await page.waitForURL(url=>new URL(url).pathname==='/admin/players/preview');
    await page.locator('[data-admin-preview-rows] tr:not(.app-players-loading-row)').first().waitFor({state:'visible'});
    assert.equal(previewCalls,3);assert.equal(commitCalls,1);
    assert.ok(sessionReads>=7,'All preview/draft/commit requests use signed Admin session+CSRF');
   }else assert.equal(await page.locator('#main-content').innerText(),'');
   assert.equal(permissionReads,writer?2:1,'Preview Back reuses the existing page history without redundant permission reads');
   assert.equal(adminCalls,0,'Directory and Players cannot invoke World Admin endpoints');
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close()}
 }
 timing.mark('directory-players-complete');
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
  const unavailableWorld=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/world'&&response.status()===503);
  await page.goto('http://localhost:2000/dashboard',{waitUntil:'domcontentloaded'});
  await unavailableWorld;
  await page.waitForFunction(()=>document.readyState==='complete'&&window.faWorldState?.get().current===null);
  assert.equal(adminCalls,0,'Anonymous public browsing must not invoke Admin APIs');
  assert.equal(await page.evaluate(()=>window.faWorldState?.get().current),null,'Unavailable world data must not fabricate current progress');
  checks++;
 }finally{await context.close();}
 // Anonymous Profile entry must not cause two or more redundant 401s:
 // one negative permission lookup on the public page is enough until refresh.
 {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
   const page=await context.newPage();
   let permissionReads=0,sessionReads=0;
   const unauthorized={status:401,contentType:'application/json',body:'{"error":{"code":"unauthorized"}}'};
   await page.route('**/api/player/permissions',route=>{permissionReads++;return route.fulfill(unauthorized)});
   await page.route('**/api/player/session',route=>{sessionReads++;return route.fulfill(unauthorized)});
   await page.route('**/api/world',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.goto('http://app.localhost:2000/dashboard',{waitUntil:'networkidle'});
   assert.equal(permissionReads,1,'First public page checks Admin link visibility once');
   await page.locator('#app-nav-profile').click();
   await page.waitForURL('**/account/login');
   await page.waitForLoadState('networkidle');
   assert.equal(permissionReads,1,'Profile/Login do not recheck Admin sidebar permissions');
   assert.equal(sessionReads,0,'The known 401 is reused for navigation to Login');
   await page.reload({waitUntil:'networkidle'});
   assert.equal(sessionReads,1,'An explicit Login refresh checks session again');
   await page.goto('http://app.localhost:2000/account',{waitUntil:'domcontentloaded'});
   await page.waitForURL('**/account/login');
   await page.waitForLoadState('networkidle');
   assert.equal(sessionReads,2,'Direct Profile verifies session once, not again on redirect');
   assert.equal(permissionReads,1,'Account pages do not send anonymous Admin checks');
   checks++;
  }finally{await context.close();}
 }
 timing.mark('anonymous-profile-complete');
 // #777: protected read-only Contracts, stable first paint, authorized pagination.
 {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let releaseInitial=()=>{},releasePage=()=>{};
  try{
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const generation='11111111-1111-4111-8111-111111111111';
   let initial=true,hold=false,permissionReads=0,writes=0;
   const initialGate=new Promise(resolve=>releaseInitial=resolve),pageGate=new Promise(resolve=>releasePage=resolve);
   await page.route('**/api/world',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.route('**/api/player/permissions',r=>{permissionReads++;return r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({permissions:['admin.access','admin.world.read']})})});
   await page.route('**/api/admin/contracts*',async r=>{
    if(r.request().method()!=='GET'){writes++;return r.fulfill({status:405,contentType:'application/json',body:'{}'})}
    const n=Number(new URL(r.request().url()).searchParams.get('page'));
    if(initial){initial=false;await initialGate}
    if(n===2&&hold){hold=false;await pageGate}
    const ids=n===1?[1,2,3,4]:[51];
    const players=ids.map(id=>({id,name:'Test Player '+id,nationality:'ITA',clubKey:id===1?'IT-1':null,
     contract:id===1?{id:7,annualSalaryArc:125,durationSeasons:2,startTick:0,endTick:112,signedAt:'2026-11-24T12:00:00.000Z'}:null}));
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({count:51,page:n,pageSize:50,totalPages:2,
     worldGeneration:generation,worldRevision:0,players,clubs:[{clubKey:'IT-1',name:'Test Italian Club'}]})}).catch(()=>{});
   });
   await page.goto('http://app.localhost:2000/admin/contracts',{waitUntil:'domcontentloaded'});
   await page.locator('.admin-contracts-skeleton').first().waitFor({state:'visible'});
   await page.locator('#app-admin[data-admin-access="granted"]').waitFor();
   assert.equal(await page.locator('[data-contract-draft]').isVisible(),false);
   const geometry=()=>page.evaluate(()=>{const head=document.querySelector('.admin-contracts-table thead');
    return {y:head.getBoundingClientRect().y,widths:[...head.querySelectorAll('th')].map(th=>th.getBoundingClientRect().width)}});
   const before=await geometry();
   assert.equal(await page.locator('.admin-contracts-skeleton').count(),5);
   assert.equal(await page.locator('[data-contracts-save],[data-contracts-trigger],[data-contracts-check]').count(),0);
   releaseInitial();
   await page.locator('[data-contracts-player="1"]').waitFor({state:'visible'});
   const after=await geometry();
   assert.ok(Math.abs(after.y-before.y)<1);
   assert.ok(after.widths.every((w,i)=>Math.abs(w-before.widths[i])<1));
   const signed=page.locator('[data-contracts-player="1"]');
   assert.match(await signed.innerText(),/Test Italian Club/);
   assert.match(await signed.innerText(),/125/);
   assert.match(await signed.innerText(),/S2 · D56/);
   assert.match(await page.locator('[data-contracts-player="2"]').innerText(),/Free Agent/);
   const flag=signed.locator('.app-players-nationality-flag');
   assert.equal(await flag.getAttribute('data-player-country'),'ITA');
   await flag.focus();
   await page.locator('#app-players-nationality-tooltip').waitFor({state:'visible'});
   await flag.press('Escape');
   await page.locator('#app-players-nationality-tooltip').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('[data-contracts-next]').click();
   await page.locator('[data-contracts-player="51"]').waitFor();
   await page.locator('[data-contracts-prev]').click();
   await page.locator('[data-contracts-player="1"]').waitFor();
   hold=true;
   const pending=page.waitForRequest(r=>new URL(r.url()).pathname==='/api/admin/contracts'&&new URL(r.url()).searchParams.get('page')==='2');
   const abort=page.waitForEvent('requestfailed',{predicate:r=>new URL(r.url()).pathname==='/api/admin/contracts'&&new URL(r.url()).searchParams.get('page')==='2'});
   await page.locator('[data-contracts-next]').click();await pending;
   await page.locator('[data-contracts-prev]').click();await abort;releasePage();
   await page.locator('[data-contracts-player="1"]').waitFor();
   assert.equal(await page.locator('[data-contracts-player="51"]').count(),0);
   assert.equal(writes,0);assert.ok(permissionReads<=2);
   assert.deepEqual(errors,[]);checks++;
  }finally{releaseInitial();releasePage();await context.close()}
 }

 // #777 writer-only contract preparation; preview does not create a signed term.
 {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let releasePermissions=()=>{},releaseList=()=>{},releasePreview=()=>{};
  try{
   const permissionGate=new Promise(resolve=>releasePermissions=resolve),listGate=new Promise(resolve=>releaseList=resolve),previewGate=new Promise(resolve=>releasePreview=resolve);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const generation='11111111-1111-4111-8111-111111111111';
   let previews=0;
   await page.route('**/api/world',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.route('**/api/player/permissions',async r=>{await permissionGate;return r.fulfill({json:{permissions:['admin.access','admin.world.read','admin.world.write']}})});
   await page.route('**/api/admin/session',r=>r.fulfill({json:{csrfToken:'test-csrf'}}));
   await page.route(/\/api\/admin\/contracts(?:\/preview|\?[^#]*)?$/,async r=>{
    const request=r.request();
    if(new URL(request.url()).pathname.endsWith('/preview')){
     previews++;assert.equal(request.method(),'POST');
     assert.equal(request.headers()['x-csrf-token'],'test-csrf');
     assert.deepEqual(request.postDataJSON(),{playerId:2,clubKey:'IT-1',durationSeasons:2,expectedGeneration:generation,expectedRevision:0});
     await previewGate;
     return r.fulfill({json:{playerId:2,clubKey:'IT-1',durationSeasons:2,startTick:0,endTick:112,representation:'ai',minimumArc:40,annualSalaryArc:null,signable:false}})
    }
    assert.equal(request.method(),'GET');
    await listGate;
    return r.fulfill({json:{count:2,page:1,pageSize:50,totalPages:1,worldGeneration:generation,worldRevision:0,
     players:[{id:1,name:'Signed Player',clubKey:'IT-1',canPrepareContract:false,contract:{id:7,annualSalaryArc:125,durationSeasons:1,startTick:0,endTick:56,signedAt:'2026-11-24T12:00:00.000Z'}},{id:2,name:'Free Player',clubKey:null,canPrepareContract:true,contract:null}],
     clubs:[{clubKey:'IT-1',name:'Test Italian Club'}]}});
   });
   await page.goto('http://app.localhost:2000/admin/contracts',{waitUntil:'domcontentloaded'});
   const form=page.locator('[data-contract-draft]');
   await form.waitFor({state:'visible'});
   await form.locator('.language-trigger').first().waitFor();
   const geometry=()=>page.evaluate(()=>['[data-contract-draft]','.admin-contract-draft-fields','.admin-contract-draft-terms','[data-contract-draft-message]','.admin-contracts-table thead'].map(sel=>{const b=document.querySelector(sel).getBoundingClientRect();return [b.x,b.y,b.width,b.height]}));
   const same=(a,b)=>a.forEach((rect,i)=>rect.forEach((v,j)=>assert.ok(Math.abs(v-b[i][j])<1,'geometry drift '+i+':'+j+' '+v+' vs '+b[i][j])));
   const first=await geometry();
   assert.equal(await form.getAttribute('data-draft-state'),'loading');
   assert.equal(await form.locator('.language-trigger').first().isDisabled(),true);
   releasePermissions();await page.locator('#app-admin[data-admin-access="granted"]').waitFor();
   same(first,await geometry());
   releaseList();await page.locator('[data-contracts-player="2"]').waitFor();
   same(first,await geometry());
   assert.equal(await form.isVisible(),true);
   assert.equal(await form.locator('[data-contract-draft-player] option').count(),2);
   const selectFromMenu=async(id,label,searchText)=>{
    const trigger=form.locator('#admin-contract-draft-dropdown-'+id).locator('..').locator('.language-trigger');
    await trigger.click();
    const menu=form.locator('#admin-contract-draft-dropdown-'+id);
    if(searchText)await menu.locator('input[type="search"]').fill(searchText);
    await menu.getByRole('option',{name:label,exact:true}).click();
    assert.equal(await trigger.getAttribute('aria-expanded'),'false');
   };
   assert.equal(await form.locator('.admin-licenses-dropdown .language-trigger').count(),3);
   await selectFromMenu(0,'Free Player','free');
   await selectFromMenu(1,'Test Italian Club','italian');
   await selectFromMenu(2,'2');
   assert.equal(await form.locator('[data-contract-draft-player]').inputValue(),'2');
   assert.equal(await form.locator('[data-contract-draft-club]').inputValue(),'IT-1');
   await form.locator('[data-contract-draft-preview]').click();
   await page.locator('[data-contract-draft][data-draft-state="preview"]').waitFor();
   same(first,await geometry());releasePreview();
   await form.locator('[data-contract-draft-start]').filter({hasText:'S1 · D1'}).waitFor();
   same(first,await geometry());
   assert.match(await form.locator('[data-contract-draft-end]').innerText(),/S2 · D56/);
   assert.equal(await form.locator('[data-contract-draft-agent]').innerText(),'AI');
   assert.equal(await form.locator('[data-contract-draft-sign]').isDisabled(),true);
   assert.match(await form.locator('[data-contract-draft-message]').innerText(),/Signing unavailable/);
   assert.equal(await form.locator('[data-contract-draft-salary]').innerText(),'—');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(previews,1);assert.deepEqual(errors,[]);checks++;
  }finally{releasePermissions();releaseList();releasePreview();await context.close()}
 }
 timing.mark('contracts-inspection-complete');

 // Rewards: same Admin controls and table geometry, read-only fixture access.
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/world',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.route('**/api/player/permissions',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({permissions:['admin.access','admin.world.read']})}));
   await page.route('**/api/admin/world',r=>{
    assert.equal(r.request().method(),'GET');
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({world:{seasonNumber:3}})});
   });
   await page.goto('http://app.localhost:2000/admin/rewards');
   await page.locator('[data-admin-rewards-content]').waitFor({state:'visible'});
   const trigger=page.locator('[data-admin-rewards-trigger]'),menu=page.locator('#admin-reward-season-options');
   assert.equal(await page.locator('[data-admin-rewards-value]').textContent(),'3');
   assert.equal(await page.locator('.admin-rewards-distribution tbody tr').count(),18);
   assert.equal(await page.locator('.admin-rewards-distribution tfoot tr').count(),1);
   await page.locator('#admin-reward-season-label').click({force:true});
   assert.equal(await trigger.getAttribute('aria-expanded'),'false');
   await trigger.focus();await trigger.press('Enter');await menu.waitFor({state:'visible'});
   await trigger.press('Home');await trigger.press('Enter');
   assert.equal(await page.locator('[data-admin-rewards-season]').inputValue(),'1');
   assert.equal(await page.locator('[data-reward-state="rewardEvidenceHistory"]').isVisible(),true);
   assert.equal(await page.locator('.admin-rewards-pool [data-reward-amount]').textContent(),'—');
   await trigger.click();await menu.getByRole('option',{name:'3',exact:true}).click();
   assert.equal(await page.locator('[data-admin-rewards-season]').inputValue(),'3');
   assert.match(await page.locator('.admin-rewards-pool [data-reward-amount]').textContent(),/2,400,000/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.ok(await page.locator('.admin-rewards-distribution tbody tr').first().evaluate(el=>{const h=el.getBoundingClientRect().height;return h>=40&&h<=48}));
   if(width===390)assert.equal(await page.locator('.admin-rewards-distribution').evaluate(el=>el.parentElement.scrollWidth>el.parentElement.clientWidth),true);
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close()}
 }
 // CLUB-LICENSES-01: control geometry, overflow, listboxes and filtered selection.
 // Synthetic API responses only; no remote Admin mutations or shared-world writes.
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   const clubs=Array.from({length:320},(_,i)=>({
    clubKey:'FA-'+(i+1),name:'Club '+(i+1),accountId:i===0?'fixture-account':null,
    accountEmail:i===0?'holder@example.invalid':null,updatedAt:null,version:0
   }));
   await page.route('**/api/world',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.route('**/api/player/permissions',r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({permissions:['admin.access','admin.world.read','admin.world.write']})}));
   await page.route('**/api/admin/club-licenses**',route=>{
    const url=new URL(route.request().url());
    assert.equal(route.request().method(),'GET','Layout QA must never assign or revoke licenses');
    return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify(url.pathname.endsWith('/accounts')
      ?{accounts:[{id:'fixture-target',email:'qa@example.invalid'}]}
      :{clubs,history:[]})});
   });
   await page.goto('http://app.localhost:2000/admin/licenses');
   await page.waitForFunction(()=>document.querySelector('[data-licenses-count]')?.textContent==='320 clubs');
   assert.equal(await page.locator('.admin-licenses-dropdown').count(),3);
   assert.equal(await page.locator('[data-licenses-rows] tr').count(),320);
   const geometry=await page.evaluate(()=>{
    const editor=document.querySelector('.admin-licenses-editor');
    const grid=document.querySelector('.admin-licenses-fields');
    const field=document.querySelector('[data-licenses-query]');
    const select=document.querySelector('.admin-licenses-fields .language-trigger');
    const table=document.querySelector('.admin-licenses-table-wrap');
    const row=document.querySelector('[data-licenses-rows] tr');
    const columns=getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
    return {
     pageOverflows:document.documentElement.scrollWidth>innerWidth,
     editorWidth:editor.getBoundingClientRect().width,
     availableWidth:document.querySelector('[data-admin-licenses]').getBoundingClientRect().width,
     columns,fieldHeight:field.getBoundingClientRect().height,
     dropdownHeight:select.getBoundingClientRect().height,
     rowHeight:row.getBoundingClientRect().height,
     tableScrollable:table.scrollWidth>table.clientWidth
    };
   });
   assert.equal(geometry.pageOverflows,false,'No page-level horizontal overflow: '+JSON.stringify({width,geometry}));
   assert.ok(Math.abs(geometry.editorWidth-geometry.availableWidth)<=2,'The panel fills its assigned column');
   assert.equal(geometry.columns,width<=760?1:2,'Form stacks on mobile');
   assert.ok(Math.abs(geometry.fieldHeight-geometry.dropdownHeight)<=2,'Text inputs and dropdowns share height');
   assert.ok(geometry.rowHeight>=40&&geometry.rowHeight<=48,'Compact table row spacing');
   if(width<=390)assert.equal(geometry.tableScrollable,true,'Tables scroll inside their own border on mobile');
   const clubDropdown=page.locator('.admin-licenses-field').first();
   // Caption hover/click is inert: no dropdown activation or text-field focus.
   const caption=clubDropdown.locator('.admin-licenses-caption'),captionRect=await caption.boundingBox();
   assert.ok(captionRect,'Club caption geometry');
   const trigger=clubDropdown.locator('.language-trigger');
   const triggerAppearance=()=>trigger.evaluate(node=>{
    const s=getComputedStyle(node);
    return {background:s.backgroundColor,border:s.borderColor,expanded:node.getAttribute('aria-expanded')};
   });
   await page.mouse.move(0,0);await page.waitForTimeout(180);
   const idle=await triggerAppearance();
   await page.mouse.move(captionRect.x+captionRect.width/2,captionRect.y+captionRect.height/2);
   await page.waitForTimeout(180);
   assert.deepEqual(await triggerAppearance(),idle,'Caption hover must not highlight dropdown');
   await page.mouse.click(captionRect.x+captionRect.width/2,captionRect.y+captionRect.height/2);
   assert.deepEqual(await triggerAppearance(),idle,'Caption click must not open dropdown');
   const searchCaption=await page.locator('#licenses-search-caption').boundingBox();
   assert.ok(searchCaption,'Account-search caption geometry');
   await page.mouse.click(searchCaption.x+searchCaption.width/2,searchCaption.y+searchCaption.height/2);
   assert.equal(await page.locator('[data-licenses-query]').evaluate(node=>document.activeElement===node),false,
    'Caption click must not focus text field');
   await clubDropdown.locator('.language-trigger').click();
   await clubDropdown.locator('.admin-licenses-dropdown-search').fill('Club 320');
   assert.equal(await clubDropdown.locator('.language-option').count(),1,'Club search narrows the menu');
   await clubDropdown.locator('.admin-licenses-dropdown-search').press('Enter');
   assert.equal(await page.locator('[data-licenses-club]').inputValue(),'FA-320');
   await page.locator('[data-licenses-query]').fill('qa@example.invalid');
   const lookupResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/club-licenses/accounts');
   await page.locator('[data-licenses-find]').click();
   const lookup=await lookupResponse;
   assert.equal(lookup.status(),200,'Verified account lookup must use the mock');
   assert.deepEqual(await lookup.json(),{accounts:[{id:'fixture-target',email:'qa@example.invalid'}]});
   const accountDropdown=page.locator('.admin-licenses-field').nth(2);
   await page.waitForFunction(()=>document.querySelector('[data-licenses-account]').options.length===2);
   assert.equal(await accountDropdown.locator('.language-trigger').isEnabled(),true,'Successful lookup enables Account');
   await accountDropdown.locator('.language-trigger').click();
   await accountDropdown.locator('.language-option').filter({hasText:'qa@example.invalid'}).click();
   assert.equal(await page.locator('[data-licenses-assign]').isEnabled(),true);
   await page.locator('.admin-licenses-filters .language-trigger').click();
   await page.locator('.admin-licenses-filters .language-option').filter({hasText:'Licensed'}).click();
   assert.equal(await page.locator('[data-licenses-count]').textContent(),'1 clubs');
   // The Admin directory card is informational: only its link is interactive.
   await page.goto('http://app.localhost:2000/admin');
   await page.locator('.admin-directory-card').first().waitFor({state:'visible'});
   const directoryGap=await page.locator('.admin-directory').evaluate(node=>parseFloat(getComputedStyle(node).gap));
   const pageGap=await page.locator('#app-admin').evaluate(node=>parseFloat(getComputedStyle(node).rowGap));
   assert.ok(Math.abs(directoryGap-pageGap)<=0.5,'Directory cards share the page section gap');
   const card=page.locator('.admin-directory-card').first();
   const titleRect=await card.locator('h2').boundingBox();
   assert.ok(titleRect,'Card title geometry');
   const cardStyle=()=>card.evaluate(node=>{
    const s=getComputedStyle(node);return {background:s.backgroundColor,border:s.borderColor};
   });
   await page.mouse.move(0,0);await page.waitForTimeout(180);
   const unhovered=await cardStyle();
   await page.mouse.move(titleRect.x+titleRect.width/2,titleRect.y+titleRect.height/2);
   await page.waitForTimeout(180);
   assert.deepEqual(await cardStyle(),unhovered,'Card title hover must not activate panel');
   await page.mouse.click(titleRect.x+titleRect.width/2,titleRect.y+titleRect.height/2);
   assert.equal(new URL(page.url()).pathname,'/admin','Card title click must not navigate');
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close()}
 }

 // NAV-ADMIN: stable first paint on navigation, refresh and revocation.
 {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let release=()=>{};
  try{
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let authorized=true,hold=false,permissionReads=0,authGate=null;
   const clubs=Array.from({length:320},(_,i)=>({clubKey:'FA-'+(i+1),name:'Club '+(i+1),
    accountId:null,accountEmail:null,updatedAt:null,version:0}));
   await page.route('**/api/world',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.route('**/api/player/permissions',async r=>{
    permissionReads++;
    if(hold&&authGate)await authGate;
    return r.fulfill({status:authorized?200:401,contentType:'application/json',
     body:authorized?JSON.stringify({permissions:['admin.access','admin.world.read','admin.world.write']}):'{}'});
   });
   await page.route('**/api/admin/club-licenses**',r=>{
    assert.equal(r.request().method(),'GET','Sidebar QA must not mutate licenses');
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({clubs,history:[]})});
   });
   await page.goto('http://app.localhost:2000/dashboard');
   await page.locator('#app-nav-admin').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('fa:admin:nav-visible:v1')),'1');
   for(const path of ['/clubs','/players','/matches','/account/login']){
    await page.goto('http://app.localhost:2000'+path,{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('#app-nav-admin').isVisible(),true,path+' Admin visible before deferred checks');
   }
   await page.goto('http://app.localhost:2000/admin/licenses');
   await page.waitForFunction(()=>document.querySelector('[data-licenses-count]')?.textContent==='320 clubs');
   assert.equal(await page.locator('#app-nav-admin[aria-current="page"]').count(),1);
   await page.goto('http://app.localhost:2000/dashboard');
   await page.locator('#app-nav-admin').waitFor({state:'visible'});
   authorized=false;hold=true;authGate=new Promise(resolve=>{release=resolve});
   await page.reload({waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#app-nav-admin').isVisible(),true,'Pending fresh check must not flash away Admin');
   hold=false;release();
   await page.waitForFunction(()=>!document.getElementById('app-nav-admin'));
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('fa:admin:nav-visible:v1')),null);
   await page.goto('http://app.localhost:2000/settings');
   assert.equal(await page.locator('#app-nav-admin').count(),0,'Revoked menu stays absent');
   assert.ok(permissionReads>=2);
   assert.deepEqual(errors,[]);checks++;
  }finally{release();await context.close()}
 }

 timing.mark('cases-complete');
  console.log('Dedicated Admin page browser contracts PASS: '+checks+' cases');
}finally{
 preview.closeAllConnections();await new Promise(resolve=>preview.close(resolve));
 await browser.close();
  timing.mark('cleanup-complete');timing.report();
}
