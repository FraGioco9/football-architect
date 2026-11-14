// Final-gate real browser flow: disposable loopback Worker/D1 only, no seeded fake sporting payloads.
import assert from 'node:assert/strict';
import {verifySeasonTwoNavigation} from './season-two-navigation-browser.mjs';
export async function verifyAdminWorldLifecycle(browser,{origin,publicOrigin=origin,password,email,legacyPassword}){
 const operator=await browser.newContext(),visitor=await browser.newContext();
 try{
  const admin=await operator.newPage(),publicPage=await visitor.newPage(),errors=[];
  for(const page of [admin,publicPage])page.on('pageerror',e=>errors.push(e.message));
  await admin.goto(origin+'/admin');
  assert.equal(await admin.locator('#admin-email,#admin-password,[data-admin-login]').count(),0);
  assert.equal(await admin.evaluate(()=>fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status)),410);
  await admin.locator('#app-admin[data-admin-access="denied"]').waitFor({state:'attached'});
  assert.equal(await admin.locator('#main-content').innerText(),'');
  await admin.locator('#app-nav-profile').click();
  await admin.waitForURL(url=>url.pathname==='/account/login');
  assert.equal(new URL(admin.url()).origin,origin);
  assert.equal(new URL(admin.url()).searchParams.has('next'),false);
  // The old Admin password must not authenticate the distinct Player identity.
  assert.equal(await admin.evaluate(async({email,legacyPassword})=>fetch('/api/player/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:legacyPassword})}).then(r=>r.status),{email,legacyPassword}),401);
  await admin.locator('#account-login input[name="email"]').fill(email);
  await admin.locator('#account-login input[name="password"]').fill(password);
  await admin.locator('#account-login button[type="submit"]').click();
  await admin.waitForURL(url=>url.pathname==='/admin');
  await admin.locator('[data-admin-card="calendar"]').click();
  await admin.waitForURL(url=>url.pathname==='/admin/calendar');
  const cookies=await operator.cookies(origin);
  assert.ok(cookies.some(cookie=>cookie.name==='fa_player_local'&&cookie.httpOnly));
  assert.ok(!cookies.some(cookie=>cookie.name.includes('fa_admin')));
  await admin.locator('[data-admin-signed-in]').waitFor({state:'visible'});
  // PERF-API-01: same-tab authorized Admin navigation on the real disposable
  // Worker/D1. Record request methods and paths only (no credentials/bodies).
  // The landing/calendar navigation has already verified and cached UI
  // permissions; protected Worker endpoints still independently authorize.
  const navHttp=[],recordNav=request=>{
   const url=new URL(request.url());
   if(url.origin===origin&&url.pathname.startsWith('/api/'))
    navHttp.push({method:request.method(),path:url.pathname});
  };
  const countNav=(list,path,method='GET')=>list.filter(row=>row.path===path&&row.method===method).length;
  let contractsNav,playersNav,calendarNav;
  admin.on('request',recordNav);
  try{
   const contractsAt=navHttp.length;
   const contractsResult=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/contracts'&&
    r.request().method()==='GET');
   await admin.goto(origin+'/admin/contracts',{waitUntil:'load'});
   assert.equal((await contractsResult).status(),200,'Authorized Contracts list is available from local D1');
   await admin.locator('#app-admin[data-admin-access="granted"]').waitFor({state:'visible'});
   await admin.locator('[data-contracts-rows][aria-busy="false"]').waitFor({state:'attached'});
   await admin.waitForFunction(()=>window.faWorldState?.get?.().worldStatus==='ready');
   contractsNav=navHttp.slice(contractsAt);
   assert.equal(countNav(contractsNav,'/api/admin/contracts'),1,'Contracts reads its list exactly once');
   assert.equal(contractsNav.filter(row=>row.path.startsWith('/api/admin/')&&row.path!=='/api/admin/contracts').length,0,
    'Contracts navigation does not fetch Calendar world/session/events');
   assert.equal(countNav(contractsNav,'/api/player/permissions'),0,
    'Established same-tab UI permission cache avoids a second read');
   const playersAt=navHttp.length;
   await admin.goto(origin+'/admin/players',{waitUntil:'load'});
   await admin.locator('#app-admin[data-admin-access="granted"] [data-admin-players]').waitFor({state:'visible'});
   await admin.waitForFunction(()=>window.faWorldState?.get?.().worldStatus==='ready');
   playersNav=navHttp.slice(playersAt);
   assert.equal(playersNav.filter(row=>row.path.startsWith('/api/admin/')).length,0,
    'Opening the Players generator does not trigger a privileged read or mutation');
   assert.equal(countNav(playersNav,'/api/player/permissions'),0,
    'Players generator reuses the per-tab permission snapshot');
   const calendarAt=navHttp.length;
   await admin.goto(origin+'/admin/calendar',{waitUntil:'load'});
   await admin.locator('[data-admin-signed-in]').waitFor({state:'visible'});
   await admin.waitForFunction(()=>document.querySelector('#app-admin [data-admin-settings]')?.getAttribute('aria-busy')==='false'&&
    !!document.querySelector('[data-admin-world]')?.textContent?.trim());
   await admin.waitForFunction(()=>window.faWorldState?.get?.().worldStatus==='ready');
   calendarNav=navHttp.slice(calendarAt);
   assert.equal(countNav(calendarNav,'/api/admin/session'),1,
    'Calendar fresh document independently confirms the operator session');
   assert.equal(countNav(calendarNav,'/api/admin/world'),1,
    'Calendar reads the authenticated world once');
   assert.equal(countNav(calendarNav,'/api/admin/seasons/events'),1,
    'Calendar reads protected events authority once');
   assert.equal(countNav(calendarNav,'/api/player/permissions'),0,
    'Known per-tab UI grants do not need another permissions fetch');
   assert.equal(navHttp.filter(row=>row.method!=='GET').length,0,
    'Read-only Admin route changes never execute a mutation');
   console.log('PERF-API-01 authenticated Admin navigation HTTP PASS: '+JSON.stringify({
    contracts:contractsNav.length,contractsListGets:countNav(contractsNav,'/api/admin/contracts'),
    players:playersNav.length,playersAdminGets:playersNav.filter(row=>row.path.startsWith('/api/admin/')).length,
    calendar:calendarNav.length,calendarAdminWorldGets:countNav(calendarNav,'/api/admin/world'),
    calendarEventsGets:countNav(calendarNav,'/api/admin/seasons/events'),
    repeatedPermissionsGets:countNav(contractsNav,'/api/player/permissions')+
     countNav(playersNav,'/api/player/permissions')+countNav(calendarNav,'/api/player/permissions')
   }));
  }finally{admin.off('request',recordNav)}
  const read=()=>admin.evaluate(()=>fetch('/api/world',{cache:'no-store'}).then(r=>r.json()).then(x=>x.world));
  const click=async(action,path)=>{
   const selector=action==='approve'?'[data-admin-next-season-approve]':action==='reset'?'[data-admin-reset]':action==='prepare'?'[data-admin-prepare]':`[data-admin-command="${action}"]`;
   await admin.waitForFunction(selector=>{const button=document.querySelector(selector);return button&&!button.disabled},selector);
   const response=admin.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='POST');
   await admin.locator(selector).focus();await admin.locator(selector).press('Enter');
   const result=await response;assert.equal(result.status(),200,await result.text());
   return (await result.json()).world;
  };
  const command=async path=>admin.evaluate(async path=>{
   const session=await fetch('/api/admin/session').then(r=>r.json()),world=await fetch('/api/world').then(r=>r.json()).then(x=>x.world);
   const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expectedGeneration:world.generation,expectedRevision:world.revision})});
   const body=await response.json();if(!response.ok)throw Error(path+': '+response.status+' '+JSON.stringify(body));return body.world;
  },path);
  let world=await read();assert.equal(world.seasonNumber,0);
  // Measure only the actual authenticated button path after the shell's cold
  // canonical world read, not this test's explicit helper GETs.
  await admin.waitForFunction(()=>window.faWorldState?.get?.().worldStatus==='ready');
  const prepareHttp=[];
  const recordPrepare=request=>{
   const url=new URL(request.url());
   if(url.origin===origin&&url.pathname.startsWith('/api/'))
    prepareHttp.push({method:request.method(),path:url.pathname});
  };
  admin.on('request',recordPrepare);
  try{
   // Register observers before the real command, including the public world
   // revalidation which must not be suppressed by authenticated GET reuse.
   const eventsRead=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/seasons/events'&&r.request().method()==='GET'&&r.status()===200);
   const worldRead=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/world'&&r.request().method()==='GET'&&r.status()===200);
   world=await click('prepare','/api/admin/seasons/prepare');
   await Promise.all([eventsRead,worldRead]);
   await admin.waitForFunction(()=>window.faWorldState?.get?.().world?.seasonNumber===1&&
    window.faWorldState?.get?.().world?.phase==='preparing'&&
    document.querySelector('#app-admin [data-admin-settings]')?.getAttribute('aria-busy')==='false');
  }finally{admin.off('request',recordPrepare)}
  assert.equal(world.seasonNumber,1);assert.equal(world.phase,'preparing');
  const count=(path,method='GET')=>prepareHttp.filter(x=>x.path===path&&x.method===method).length;
  assert.equal(count('/api/admin/seasons/prepare','POST'),1,'one guarded Admin season preparation');
  assert.equal(count('/api/admin/world'),0,'validated post-write world avoids a redundant protected GET');
  assert.equal(count('/api/admin/seasons/events'),1,'protected events authority remains checked');
  assert.equal(count('/api/world'),1,'public world invalidation still performs one canonical revalidation');
  assert.equal(await admin.evaluate(()=>window.faWorldState.get().world.revision),world.revision,
   'the public canonical adapter must publish the exact new world revision');
  console.log('PERF-API-01 authenticated Admin prepare HTTP PASS: '+JSON.stringify({
   commandPost:count('/api/admin/seasons/prepare','POST'),
   redundantAdminWorldGets:count('/api/admin/world'),
   protectedEventsGets:count('/api/admin/seasons/events'),
   publicInvalidationWorldGets:count('/api/world')
  }));
  console.log('Unified Admin browser: Player sign-in and Season 1 preparation PASS');
  await click('initialize','/api/admin/seasons/events/initialize');
  await click('eventStart','/api/admin/seasons/events/start');
  assert.equal(await admin.locator('[data-admin-command="eventAdvance"]').isEnabled(),false);
  await click('confirm','/api/admin/seasons/events/confirm');await click('confirm','/api/admin/seasons/events/confirm');
  await click('eventAdvance','/api/admin/seasons/events/advance');
  await click('domestic','/api/admin/seasons/events/domestic-calendar');
  await click('eventAdvance','/api/admin/seasons/events/advance');
  await click('draw','/api/admin/seasons/events/international-draw');
  await click('publish','/api/admin/seasons/events/international-calendar');
  await click('advance','/api/admin/seasons/advance');
  world=await read();assert.equal(world.day,4);
  for(let day=5;day<=56;day++)world=await command('/api/admin/seasons/advance');
  await admin.reload();await click('archive','/api/admin/seasons/archive');
  await click('close','/api/admin/seasons/close');
  console.log('Unified Admin browser: Season 1 day 56, archive and close PASS');
  assert.equal(await admin.locator('[data-admin-command="nextPrepare"]').isDisabled(),true,'Approval must precede activation');
  await admin.locator('[data-admin-next-season-confirm]').fill('APPROVE SEASON 2');
  await click('approve','/api/admin/seasons/next-approve');
  world=await click('nextPrepare','/api/admin/seasons/next-prepare');
  assert.equal(world.seasonNumber,2);assert.equal(world.day,0);assert.equal(world.phase,'preparing');
  await click('initialize','/api/admin/seasons/events/initialize');await click('eventStart','/api/admin/seasons/events/start');
  assert.equal(await admin.locator('[data-admin-command="eventAdvance"]').isEnabled(),false);
  await click('confirm','/api/admin/seasons/events/confirm');await click('confirm','/api/admin/seasons/events/confirm');
  await click('eventAdvance','/api/admin/seasons/events/advance');
  await click('domestic','/api/admin/seasons/events/domestic-calendar');
  await click('eventAdvance','/api/admin/seasons/events/advance');
  await click('draw','/api/admin/seasons/events/international-draw');
  await click('publish','/api/admin/seasons/events/international-calendar');
  await click('advance','/api/admin/seasons/advance');
  // A separate cookie jar reads exactly the same world but has no administrative authority.
  console.log('Unified Admin browser: approved Season 2 initialization PASS');
  await publicPage.goto(origin+'/dashboard');
  assert.equal(await publicPage.evaluate(()=>fetch('/api/admin/session').then(r=>r.status)),401);
  await publicPage.goto(publicOrigin+'/dashboard');
  assert.deepEqual(await publicPage.evaluate(()=>fetch('/api/world').then(r=>r.json()).then(x=>x.world)),await read());
  let adminCalls=0;await publicPage.route('**/api/admin/**',route=>{adminCalls++;return route.continue()});
  await verifySeasonTwoNavigation(publicPage,publicOrigin);console.log('Unified Admin browser: anonymous Season 2 and historical navigation PASS');assert.equal(adminCalls,0,'Public consumers must not request Admin data');
  await publicPage.goto(publicOrigin+'/competitions/it-1/standings');
  await publicPage.waitForFunction(()=>window.faCompetitionContext?.selectedSeason===2&&window.faCompetitionContext?.seasonData?.provenance?.kind==='authoritative');
  assert.equal(await publicPage.evaluate(()=>window.faDevPreviewMode===true||document.documentElement.dataset.faDevCurrentSeason!==undefined),false,'Public browser must not be in DEV mode');
  // Record actual authoritative commits in the next document, including transient commits.
  await publicPage.addInitScript(()=>{
   window.__faAuthoritativeCommits=[];
   window.addEventListener('fa:competition-context-change',event=>{if(event.detail?.seasonData?.provenance?.kind==='authoritative')window.__faAuthoritativeCommits.push(event.detail.seasonData.provenance.sourceRef)});
  });
  // Hold an actual old-world projection across reset: the second world read must reject it.
  let release,intercepted,interceptFailed;const held=new Promise(r=>{release=r}),seen=new Promise((resolve,reject)=>{intercepted=resolve;interceptFailed=reject});
  await publicPage.route('**/api/competitions/IT-1/seasons/1',async route=>{
   try{const old=await route.fetch();intercepted();await held;await route.fulfill({response:old})}catch(error){interceptFailed(error);await route.abort().catch(()=>{});}
  },{times:1});
  const navigation=publicPage.goto(publicOrigin+'/competitions/it-1/fixtures?season=1',{waitUntil:'domcontentloaded'});
  await seen;await navigation;
  const previous=await read();
  await admin.locator('[data-admin-reset-confirm]').fill('WRONG');
  assert.equal(await admin.locator('[data-admin-reset]').isDisabled(),true);
  await admin.locator('[data-admin-reset-confirm]').fill('RESET SEASON 0');
  const reread=publicPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/world'&&r.status()===200);
  world=await click('reset','/api/admin/world/reset');release();
  assert.notEqual(world.generation,previous.generation);assert.equal(world.seasonNumber,0);
  await reread;
  await publicPage.waitForFunction(()=>window.faCompetitionContext&&document.documentElement.dataset.faStandingsLoading==='false');
  assert.ok(!(await publicPage.locator('body').innerText()).includes('Season data is unavailable.'));
  assert.equal(await publicPage.evaluate(()=>window.faCompetitionContext?.seasonData),null);
  assert.deepEqual(await publicPage.evaluate(()=>window.__faAuthoritativeCommits),[],'An old projection must never commit, even transiently');
  const deleted=await publicPage.evaluate(()=>fetch('/api/competitions/IT-1/seasons/1').then(r=>r.json()));
  assert.equal(deleted.status,'empty');assert.equal(deleted.data,null);assert.equal(deleted.world.generation,world.generation);
  assert.equal(await admin.evaluate(()=>fetch('/api/admin/session').then(r=>r.status)),200,'Reset preserves operator access');
  const prepared=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/seasons/prepare'&&r.request().method()==='POST');
  await admin.waitForFunction(()=>!document.querySelector('[data-admin-prepare]').disabled);
  await admin.locator('[data-admin-prepare]').click();assert.equal((await prepared).status(),200);
  world=await read();assert.equal(world.seasonNumber,1);assert.equal(world.phase,'preparing');
  assert.equal(world.generation,deleted.world.generation);assert.deepEqual(errors,[]);
  return {unifiedPlayerLogin:true,retiredAdminLoginDenied:true,distinctCredentials:true,twoSeasonLifecycle:true,anonymousIsolation:true,historicalNavigation:true,staleResetProjection:true,freshInitialization:true};
 }finally{await operator.close();await visitor.close()}
}
