// Final-gate real browser flow: disposable loopback Worker/D1 only, no seeded fake sporting payloads.
import assert from 'node:assert/strict';
import {verifySeasonTwoNavigation} from './season-two-navigation-browser.mjs';
export async function verifyAdminWorldLifecycle(browser,{origin,password}){
 const operator=await browser.newContext(),visitor=await browser.newContext();
 try{
  const admin=await operator.newPage(),publicPage=await visitor.newPage(),errors=[];
  for(const page of [admin,publicPage])page.on('pageerror',e=>errors.push(e.message));
  await admin.goto(origin+'/settings');await admin.locator('#admin-email').fill('operator@example.invalid');
  await admin.locator('#admin-password').fill(password);await admin.locator('#admin-password').press('Enter');
  await admin.locator('[data-admin-signed-in]').waitFor({state:'visible'});
  const read=()=>admin.evaluate(()=>fetch('/api/world',{cache:'no-store'}).then(r=>r.json()).then(x=>x.world));
  const click=async(action,path)=>{
   const selector=action==='approve'?'[data-admin-next-season-approve]':action==='reset'?'[data-admin-reset]':`[data-admin-command="${action}"]`;
   await admin.waitForFunction(selector=>!document.querySelector(selector)?.disabled,selector);
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
  let world=await read();assert.equal(world.seasonNumber,1);assert.equal(world.phase,'preparing');
  await click('initialize','/api/admin/seasons/events/initialize');
  await click('eventStart','/api/admin/seasons/events/start');
  for(let day=2;day<=4;day++)await click('eventAdvance','/api/admin/seasons/events/advance');
  world=await read();assert.equal(world.day,4);
  for(let day=5;day<=56;day++)world=await command('/api/admin/seasons/advance');
  await admin.reload();await click('archive','/api/admin/seasons/archive');
  await click('close','/api/admin/seasons/close');
  assert.equal(await admin.locator('[data-admin-command="nextPrepare"]').isDisabled(),true,'Approval must precede activation');
  await admin.locator('[data-admin-next-season-confirm]').fill('APPROVE SEASON 2');
  await click('approve','/api/admin/seasons/next-approve');
  world=await click('nextPrepare','/api/admin/seasons/next-prepare');
  assert.equal(world.seasonNumber,2);assert.equal(world.day,0);assert.equal(world.phase,'preparing');
  await click('initialize','/api/admin/seasons/events/initialize');await click('eventStart','/api/admin/seasons/events/start');
  for(let day=2;day<=4;day++)await click('eventAdvance','/api/admin/seasons/events/advance');
  // A separate cookie jar reads exactly the same world but has no administrative authority.
  await publicPage.goto(origin+'/dashboard');
  assert.equal(await publicPage.evaluate(()=>fetch('/api/admin/session').then(r=>r.status)),401);
  assert.deepEqual(await publicPage.evaluate(()=>fetch('/api/world').then(r=>r.json()).then(x=>x.world)),await read());
  let adminCalls=0;await publicPage.route('**/api/admin/**',route=>{adminCalls++;return route.continue()});
  await verifySeasonTwoNavigation(publicPage,origin);assert.equal(adminCalls,0,'Public consumers must not request Admin data');
  await publicPage.goto(origin+'/competitions/it-1/standings');
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
   try{const old=await route.fetch();intercepted();await held;await route.fulfill({response:old})}catch(error){interceptFailed(error);throw error}
  },{times:1});
  const navigation=publicPage.goto(origin+'/competitions/it-1/fixtures?season=1',{waitUntil:'domcontentloaded'});
  await seen;await navigation;
  const previous=await read();
  await admin.locator('[data-admin-reset-confirm]').fill('WRONG');
  assert.equal(await admin.locator('[data-admin-reset]').isDisabled(),true);
  await admin.locator('[data-admin-reset-confirm]').fill('RESET SEASON 0');
  const reread=publicPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/world'&&r.status()===200);
  world=await click('reset','/api/admin/world/reset');release();
  assert.notEqual(world.generation,previous.generation);assert.equal(world.seasonNumber,0);
  await reread;
  await publicPage.waitForFunction(()=>document.querySelector('.app-competition-status')?.textContent==='Season data is unavailable.');
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
  return {twoSeasonLifecycle:true,anonymousIsolation:true,historicalNavigation:true,staleResetProjection:true,freshInitialization:true};
 }finally{await operator.close();await visitor.close()}
}
