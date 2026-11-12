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
    if(previewCalls<=2)assert.equal(options.seed,'admin-trial');
    else assert.match(options.seed,/^fa-next-11111111-1111-4111-8111-111111111111$/);
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
    if(draftCommitted)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:{code:'players_preview_expired'}})});
    const candidates=[0,1].map(i=>({preview_id:'trial-000'+(i+1),
     display_name:'Luca '+(i?'Bianchi':'Rossi'),nationality:'ITA',age:18,initial_age:18,
     primary_position:'ST',secondary_positions:i?['RW']:[],preferred_foot:'right',height_cm:180,
     attributes:{speed:60,strength:60,stamina:60,agility:60,passing:60,technique:60,dribbling:60,
      shooting:70,crossing:60,tackling:60,marking:60,heading:60,vision:60,positioning:60,
      decisions:60,composure:60,gk_reflexes:60,gk_handling:60,gk_positioning:60,gk_aerial:60}}));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     draftId:'11111111-1111-4111-8111-111111111111',summary:{count:2,seed:currentOptions.seed,countries:{ITA:2}},
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
    await page.locator('[data-admin-players-label="age"]').hover();
    await page.waitForTimeout(220);
    assert.deepEqual(await readLabel(),beforeFocus,'Hover on field caption must not highlight the label');
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
    assert.equal(await page.locator('[data-players-option="primarySuitability"]').inputValue(),'');
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
    assert.equal(await page.locator('[data-detail-panel="overview"] dd').count(),6);
    assert.equal(await page.locator('[data-detail-panel="attributes"] [data-detail-attr-slot]').count(),8);
    await page.locator('[data-detail-view="attributes"]').click();
    await page.locator('[data-detail-group="mental"]').click();
    assert.equal(await page.locator('[data-detail-attr-slot]:visible').count(),4);
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
    assert.equal(await page.locator('[data-players-option="seed"]').inputValue(),'fa-next-11111111-1111-4111-8111-111111111111','Seed advances after an approved generation');
    assert.equal(await page.locator('[data-admin-players-preview]').isEnabled(),true,'Next cohort is immediately previewable');
    await page.locator('[data-admin-players-preview]').click();
    await page.waitForURL(url=>new URL(url).pathname==='/admin/players/preview');
    await page.locator('[data-admin-preview-rows] tr:not(.app-players-loading-row)').first().waitFor({state:'visible'});
    assert.equal(previewCalls,3);assert.equal(commitCalls,1);
    assert.ok(sessionReads>=7,'All preview/draft/commit requests use signed Admin session+CSRF');
   }else assert.equal(await page.locator('#main-content').innerText(),'');
   assert.equal(permissionReads,writer?9:2,'Each Admin document checks permissions independently');
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
  const unavailableWorld=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/world'&&response.status()===503);
  await page.goto('http://localhost:2000/dashboard',{waitUntil:'domcontentloaded'});
  await unavailableWorld;
  await page.waitForFunction(()=>document.readyState==='complete'&&window.faWorldState?.get().current===null);
  assert.equal(adminCalls,0,'Anonymous public browsing must not invoke Admin APIs');
  assert.equal(await page.evaluate(()=>window.faWorldState?.get().current),null,'Unavailable world data must not fabricate current progress');
  checks++;
 }finally{await context.close();}
 console.log('Dedicated Admin page browser contracts PASS: '+checks+' cases');
}finally{
 preview.closeAllConnections();await new Promise(resolve=>preview.close(resolve));
 await browser.close();
}
