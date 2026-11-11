// REPO-493 step 05: focused real-browser evidence, not the entire audit matrix.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';

const engine=process.env.FA_REPO_493_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
const playwright=await import('playwright');
// The DEV server deliberately accepts only Host on port 2000.
// Adapt the ephemeral test port to that canonical Host, as PAGE-LOAD-02 does;
// never weaken the server's Host validation for tests.
const preview=createPreviewServer({devPreview:true});
const server=createServer((req,res)=>{
 req.headers.host='127.0.0.1:2000';
 preview.emit('request',req,res);
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const evidence=[];
let browser;
const views=['standings','postseason','fixtures','stats','history','rules','awards'];
const competitions=[['it-1',390],['eng-2',1440],['int-1',390],['int-2',1440]];
const clubs=[['it',1,'overview',390],['eng',40,'fixtures',1440],['br',1,'stats',390],['nl',40,'history',1440]];
function record(route,width,stage,status,details){
 evidence.push({route,width,stage,status,details});
}
try{
 browser=await playwright[engine].launch({headless:true});
 for(const [id,width] of competitions)for(const view of views){
  const route='/competitions/'+id+'/'+view+'?season=1';
  const page=await browser.newPage({viewport:{width,height:900}});
  try{
   const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(response?.status(),200,route);
   const state=await page.evaluate(()=>{
    const tabs=[...document.querySelectorAll('#app-divisions .app-competition-tab')];
    const panels=[...document.querySelectorAll('#app-divisions > .app-competition-panel')];
    return {
     selectedView:document.documentElement.dataset.competitionView,
     tabCount:tabs.length,
     selected:tabs.filter(e=>e.getAttribute('aria-selected')==='true').map(e=>e.id),
     panelCount:panels.length,
     visible:panels.filter(e=>!e.hidden).map(e=>e.id),
     seasonReserved:!!document.querySelector('#app-competition-season-control'),
     fixturesReserved:!!document.querySelector('#app-fixtures-round'),
     tabsHeight:document.querySelector('#app-divisions > .app-competition-tabs')?.getBoundingClientRect().height??0
    };
   });
   assert.equal(state.selectedView,view,route+' parsed view');
   assert.equal(state.tabCount,7,route+' tabs');
   assert.deepEqual(state.selected,['competition-tab-'+view],route+' active tab');
   assert.equal(state.panelCount,7,route+' panels');
   assert.deepEqual(state.visible,['competition-panel-'+view],route+' active panel');
   assert.equal(state.seasonReserved,true,route+' season slot');
   assert.equal(state.fixturesReserved,true,route+' fixture selector slot');
   assert.ok(state.tabsHeight>0,route+' tab geometry');
   record(route,width,'DOMContentLoaded','PASS',state);
  }catch(error){record(route,width,'DOMContentLoaded','FAIL',String(error));throw error;}
  finally{await page.close();}
 }
 for(const [country,id,view,width] of clubs){
  const route='/clubs/'+country+'/'+id+'/'+view;
  const page=await browser.newPage({viewport:{width,height:900}});
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  await page.route('**/clubs/_shared/manifest.json',async request=>{
   await pending;
   if(page.isClosed())return;
   try{await request.continue();}
   catch(error){if(!page.isClosed()&&!/Route is already handled|Target closed/i.test(String(error)))throw error;}
  });
  try{
   const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(response?.status(),200,route);
   await page.waitForFunction(()=>document.documentElement.dataset.clubShellReady==='true',null,{timeout:15000});
   const first=await page.evaluate(()=>{
    const tabs=[...document.querySelectorAll('#club-page > .club-tabs [data-club-first-paint-tab]')];
    return {title:document.querySelector('#club-title')?.textContent,
      selected:tabs.filter(e=>e.getAttribute('aria-current')==='page').map(e=>e.dataset.clubFirstPaintTab),
      tabCount:tabs.length,
      ready:document.documentElement.dataset.clubReady==='true'};
   });
   assert.equal(first.title,'',route+' anonymous first paint');
   assert.equal(first.tabCount,5,route+' static tabs');
   assert.deepEqual(first.selected,[view],route+' initial selection');
   assert.equal(first.ready,false,route+' manifest held');
   record(route,width,'held-manifest','PASS',first);
   release();
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true',null,{timeout:25000});
   const title=await page.locator('#club-title').textContent();
   assert.ok(title?.trim(),route+' hydrated name');
   assert.equal(await page.locator('#club-page > .club-tabs [aria-current="page"]').count(),1);
   record(route,width,'hydrated','PASS',{title});
  }catch(error){record(route,width,'club-first-paint','FAIL',String(error));throw error;}
  finally{release();await page.close();}
 }
 // Step 07: keep the real runtime entrypoint pending while parser-time UI settles.
 // This checks actual HTML/CSS and inline first-paint logic before any app data
 // can hydrate, rather than extracting/rewriting the bootstrap in a fake DOM.
 for(const [competitionId,width] of [['it-1',390],['int-1',1440]]){
  for(const view of ['history','fixtures','stats']){
   const route='/competitions/'+competitionId+'/'+view+'?season=1';
   const page=await browser.newPage({viewport:{width,height:900}});
   let releaseApp;
   const appGate=new Promise(resolve=>{releaseApp=resolve;});
   await page.route('**/assets/competition-page.js',async request=>{
    await appGate;
    if(page.isClosed())return;
    try{await request.continue();}
    catch(error){
     if(!page.isClosed()&&!/Route is already handled|Target closed/i.test(String(error)))throw error;
    }
   });
   try{
    // A blocked defer script prevents DOMContentLoaded by design. The parser
    // still creates static panels and runs inline first-paint scripts.
    const response=await page.goto(origin+route,{waitUntil:'commit',timeout:30000});
    assert.equal(response?.status(),200,route+' public static document');
    await page.waitForSelector('script[data-fa-competition-selected-panel-first-paint]',
     {state:'attached',timeout:25000});
    const before=await page.evaluate(view=>{
     const panel=document.getElementById('competition-panel-'+view);
     const tabs=[...document.querySelectorAll('#app-divisions .app-competition-tab')];
     const other=[...document.querySelectorAll('#app-divisions > .app-competition-panel')]
      .filter(p=>p!==panel&&!p.hidden).map(p=>p.id);
     const root=panel?.querySelector('[data-competition-skeleton-root]');
     // Fixtures has its own static toolbar and dedicated match skeleton,
     // not a generic Stats/History data-competition-skeleton-root.
     const reserved=view==='fixtures'?panel?.querySelector('#app-fixtures-toolbar'):root;
     const elements={
      view:document.documentElement.dataset.competitionView,
      panelHidden:panel?.hidden,
      otherVisible:other,
      tabs:tabs.length,
      active:tabs.filter(t=>t.getAttribute('aria-selected')==='true').map(t=>t.id),
      skeleton:root?.dataset.competitionSkeletonRoot??null,
      reservedHeight:reserved?.getBoundingClientRect().height??0,
      reservationTarget:view==='fixtures'?'fixture-round-toolbar':'view-skeleton',
      panelBusy:panel?.getAttribute('aria-busy'),
      scoreRows:panel?.querySelectorAll('[data-fixture-match]').length??0
     };
     if(view==='history'){
      elements.archiveRows=panel.querySelectorAll('[data-skeleton-archive-row]:not([hidden])').length;
      elements.recordGroups=panel.querySelectorAll('[data-history-team-records], [data-history-player-records]').length;
      elements.emptyVisible=[...panel.querySelectorAll('[data-history-archive-empty],[data-history-team-empty],[data-history-player-empty]')]
       .filter(n=>n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden').length;
     }else if(view==='fixtures'){
      const rows=[...panel.querySelectorAll('#app-fixtures-skeleton [data-skeleton-fixture]')];
      elements.fixtureRows=rows.length;
      elements.crestPairs=rows.filter(row=>row.querySelectorAll('.app-fixtures-skeleton-crest').length===2).length;
      elements.fakeClubNames=panel.querySelectorAll('#app-fixtures-skeleton [data-club-crest]').length;
      elements.selectedRound=document.getElementById('app-fixtures-round-number')?.textContent?.trim();
     }else if(view==='stats'){
      elements.statsNavigation=[...panel.querySelectorAll('[data-competition-skeleton-root] [data-stats-view]')]
       .map(n=>n.dataset.statsView);
      elements.initialCards=panel.querySelectorAll('[data-competition-skeleton-root] .fa-dev-stats-card').length;
     }
     return elements;
    },view);
    assert.equal(before.view,view,route+' view at first paint');
    assert.equal(before.panelHidden,false,route+' selected panel must be visible');
    assert.deepEqual(before.otherVisible,[],route+' no unrelated panel');
    assert.equal(before.tabs,7);
    assert.deepEqual(before.active,['competition-tab-'+view]);
    assert.ok(before.reservedHeight>0,route+' reserves measured '+before.reservationTarget+' geometry');
    assert.equal(before.panelBusy,'true','unresolved provider must remain busy');
    assert.equal(before.scoreRows,0,'never invent fixture results during first paint');
    if(view==='history'){
     assert.equal(before.skeleton,'history-preview');
     assert.ok(before.archiveRows>=1,'unknown public completed-season count reserves an archive row');
     assert.equal(before.emptyVisible,0,'unverified History must not claim empty');
    }else if(view==='fixtures'){
     assert.ok(before.fixtureRows>0,'fixture skeleton rows exist without schedule');
     assert.equal(before.crestPairs,before.fixtureRows,'every fixture row has two placeholder crest slots');
     assert.equal(before.fakeClubNames,0,'fixtures skeleton does not invent club identities');
     assert.equal(before.selectedRound,'1','season 1 no-matchday URL reserves first choice');
    }else{
     assert.equal(before.skeleton,'stats-overview');
     assert.deepEqual(before.statsNavigation,['overview','teams','players']);
     assert.equal(before.initialCards,3);
     // Inline controls must function even with the external runtime blocked.
     await page.evaluate(()=>{
      document.querySelector('#competition-panel-stats [data-competition-skeleton-root] [data-stats-view="teams"]').click();
     });
     const teams=await page.evaluate(()=>{
      const panel=document.getElementById('competition-panel-stats'),root=panel.querySelector('[data-competition-skeleton-root]');
      return {chosen:root.dataset.competitionSkeletonRoot,
       cards:root.querySelectorAll('.fa-dev-stats-team-card').length,
       circles:root.querySelectorAll('.app-view-skeleton-crest-slot').length,
       selected:panel.dataset.faStatsSelectedView};
     });
     assert.equal(teams.chosen,'stats-teams');
     assert.equal(teams.cards,7);
     assert.equal(teams.circles,35,'7 top-five lists reserve authentic crest circles');
     assert.equal(teams.selected,'teams');
     await page.evaluate(()=>{
      const button=document.querySelector('#competition-panel-stats [data-competition-skeleton-root] [data-stats-view="teams"]');
      button.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
     });
     const players=await page.evaluate(()=>{
      const panel=document.getElementById('competition-panel-stats'),root=panel.querySelector('[data-competition-skeleton-root]');
      return {chosen:root.dataset.competitionSkeletonRoot,cards:root.querySelectorAll('.fa-dev-stats-leader-card').length,
       circles:root.querySelectorAll('.app-view-skeleton-crest-slot').length,selected:panel.dataset.faStatsSelectedView};
     });
     assert.equal(players.chosen,'stats-players');
     assert.equal(players.cards,4);
     assert.equal(players.circles,20);
     assert.equal(players.selected,'players');
     before.statsAfterInteractions={teams,players};
    }
    record(route,width,'step-07-parser-time-'+view,'PASS',before);
   }catch(error){
    record(route,width,'step-07-parser-time-'+view,'FAIL',String(error));throw error;
   }finally{releaseApp();await page.close();}
  }
 }
 // Step 07: a controlled pre-hydration History clock probe. The local Debug
 // flag/clock are injected into a real browser before the inline parser script
 // runs. This does NOT stand in for a complete runtime Debug toggle/E2E test.
 const historyClockCases=[
  {name:'public-unknown-stale-debug-zero',debug:false,devSeason:0,
   progress:null,expectedRows:1,staticEmpty:false},
  {name:'local-debug-season-zero',debug:true,devSeason:0,
   progress:null,expectedRows:0,staticEmpty:true},
  {name:'public-confirmed-season-three-day-one',debug:false,devSeason:0,
   progress:{currentSeason:3,day:1,matchdays:0},expectedRows:2,staticEmpty:false}
 ];
 for(const [competitionId,width] of [['it-1',390],['int-1',1440]]){
  for(const clock of historyClockCases){
   const route='/competitions/'+competitionId+'/history?season=1';
   const page=await browser.newPage({viewport:{width,height:900}});
   let releaseApp;
   const blocked=new Promise(resolve=>{releaseApp=resolve});
   await page.addInitScript(({debug,devSeason,progress})=>{
    window.faDebugEnabled=debug;
    document.documentElement.dataset.faDevSeasons='0,1,2,3,4,5';
    document.documentElement.dataset.faDevCurrentSeason=String(devSeason);
    if(progress)window.faFixturesInitialProgress=progress;
   },clock);
   await page.route('**/assets/competition-page.js',async request=>{
    await blocked;
    if(page.isClosed())return;
    try{await request.continue();}
    catch(error){
     if(!page.isClosed()&&!/Route is already handled|Target closed/i.test(String(error)))throw error;
    }
   });
   try{
    const response=await page.goto(origin+route,{waitUntil:'commit',timeout:30000});
    assert.equal(response?.status(),200,route+' prepaint HTML');
    await page.waitForSelector('script[data-fa-competition-selected-panel-first-paint]',
      {state:'attached',timeout:25000});
    const state=await page.evaluate(()=>{
     const panel=document.getElementById('competition-panel-history');
     const root=panel.querySelector('[data-competition-skeleton-root]');
     const archiveEmpty=panel.querySelector('[data-history-archive-empty]');
     const staticEmpty=panel.querySelector('[data-history-empty]');
     return {
      active:document.documentElement.dataset.competitionView,
      panelHidden:panel.hidden,
      skeletonRoot:root?.dataset.competitionSkeletonRoot??null,
      visibleArchiveSkeletonRows:panel.querySelectorAll('[data-skeleton-archive-row]:not([hidden])').length,
      staticEmptyPresent:!!staticEmpty,
      archiveEmptyConfirmed:archiveEmpty?.hasAttribute('hidden')===false,
      spinnerBusy:panel.getAttribute('aria-busy'),
      realClubLinks:root?.querySelectorAll('[data-club-crest]').length??0
     };
    });
    assert.equal(state.active,'history');
    assert.equal(state.panelHidden,false);
    assert.equal(state.staticEmptyPresent,true,'permanent static History structure exists');
    assert.equal(state.visibleArchiveSkeletonRows,clock.expectedRows,
     clock.name+' reserves only supported archive rows');
    assert.equal(state.archiveEmptyConfirmed,clock.staticEmpty,
     clock.name+' cannot claim empty outside confirmed local Season 0');
    assert.equal(state.skeletonRoot,clock.staticEmpty?null:'history-preview');
    assert.equal(state.realClubLinks,0,'prepaint clock must not invent archive club identities');
    record(route,width,'step-07-history-clock-'+clock.name,'PASS',state);
   }catch(error){
    record(route,width,'step-07-history-clock-'+clock.name,'FAIL',String(error));
    throw error;
   }finally{releaseApp();await page.close();}
  }
 }
 // Exercise the real shared CSS/renderer in a clean DOM, holding a known SVG
 // request to inspect neutral fallback, circular skeleton, resolved image and error.
 const harness='/__fa_repo493_crest_harness';
 const crestPage=await browser.newPage({viewport:{width:390,height:640}});
 let releaseCrest;
 const crestGate=new Promise(resolve=>{releaseCrest=resolve;});
 let deRequests=0;
 await crestPage.route('**/assets/clubs/DE/1/crest.svg',async request=>{
  deRequests++;
  await crestGate;
  if(crestPage.isClosed())return;
  try{await request.continue();}
  catch(error){if(!crestPage.isClosed()&&!/Route is already handled|Target closed/i.test(String(error)))throw error;}
 });
 await crestPage.route('**/assets/clubs/BR/1/crest.svg',async request=>{
  await request.abort('failed');
 });
 await crestPage.route('**/__fa_repo493_crest_harness',async request=>{
  await request.fulfill({status:200,contentType:'text/html',body:[
   '<!doctype html><html lang="en"><head><meta charset="utf-8">',
   '<link rel="stylesheet" href="/assets/landing.css">',
   '<link rel="stylesheet" href="/assets/app.css">',
   '<script>window.faClubCrests={"DE-1":"assets/clubs/DE/1/crest.svg","BR-1":"assets/clubs/BR/1/crest.svg"};</script>',
   '<script src="/assets/club-crests.js" defer></script>',
   '</head><body class="app-body">',
   '<span id="fa493-crest" class="app-world-club-crest-placeholder fa-crest-loading"',
   ' style="width:64px;height:64px" data-club-crest="IT-1"></span>',
   '</body></html>'
  ].join('')});
 });
 try{
  assert.equal((await crestPage.goto(origin+harness,{waitUntil:'domcontentloaded',timeout:30000}))?.status(),200);
  await crestPage.waitForFunction(()=>document.querySelector('#fa493-crest')?.dataset.clubCrestFallback==='true');
  const absent=await crestPage.evaluate(()=>{
   const host=document.querySelector('#fa493-crest');
   return {fallback:host.dataset.clubCrestFallback,
    pending:host.dataset.clubCrestPending??null,images:host.querySelectorAll('img').length};
  });
  assert.equal(absent.fallback,'true');
  assert.equal(absent.pending,null);
  assert.equal(absent.images,0);
  record(harness,390,'real-dom-absent-crest','PASS',absent);
  await crestPage.evaluate(()=>document.querySelector('#fa493-crest').dataset.clubCrest='DE-1');
  await crestPage.waitForFunction(()=>document.querySelector('#fa493-crest')?.dataset.clubCrestPending==='true');
  const pending=await crestPage.evaluate(()=>{
   const host=document.querySelector('#fa493-crest');
   const pseudo=getComputedStyle(host,'::before');
   return {fallback:host.dataset.clubCrestFallback??null,
    pending:host.dataset.clubCrestPending,
    loaded:host.dataset.clubCrestLoaded??null,
    circleDisplay:pseudo.display,circleRadius:pseudo.borderRadius,
    imageCount:host.querySelectorAll('img').length,
    imageVisibility:getComputedStyle(host.querySelector('img')).visibility};
  });
  assert.equal(pending.fallback,null,'known SVG must clear previous neutral fallback immediately');
  assert.equal(pending.pending,'true');
  assert.equal(pending.loaded,null);
  assert.equal(pending.imageCount,1);
  assert.equal(pending.circleDisplay,'block');
  assert.equal(pending.circleRadius,'50%','shared skeleton is circular');
  assert.equal(pending.imageVisibility,'hidden','known SVG is not revealed before load');
  assert.equal(deRequests,1,'one in-flight request for known SVG');
  record(harness,390,'real-dom-known-pending','PASS',pending);
  releaseCrest();
  await crestPage.waitForFunction(()=>document.querySelector('#fa493-crest')?.dataset.clubCrestLoaded==='true');
  const loaded=await crestPage.evaluate(async()=>{
   const host=document.querySelector('#fa493-crest');
   const img=host.querySelector('img');
   const visibility=getComputedStyle(img).visibility;
   host.setAttribute('data-club-crest','DE-1');
   await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
   return {fallback:host.dataset.clubCrestFallback??null,
    loaded:host.dataset.clubCrestLoaded,
    pending:host.dataset.clubCrestPending??null,
    visible:visibility,
    imageStable:host.querySelector('img')===img,
    imageCount:host.querySelectorAll('img').length};
  });
  assert.equal(loaded.loaded,'true');
  assert.equal(loaded.fallback,null);
  assert.equal(loaded.pending,null);
  assert.equal(loaded.visible,'visible');
  assert.equal(loaded.imageStable,true,'re-observation preserves existing image node');
  assert.equal(loaded.imageCount,1);
  assert.equal(deRequests,1,'no redundant request when identity remains unchanged');
  record(harness,390,'real-dom-loaded-and-reused','PASS',loaded);
  await crestPage.evaluate(()=>document.querySelector('#fa493-crest').dataset.clubCrest='BR-1');
  await crestPage.waitForFunction(()=>{
   const host=document.querySelector('#fa493-crest');
   return host?.dataset.clubCrestFallback==='true'&&host.querySelector('img')===null;
  });
  const failed=await crestPage.evaluate(()=>{
   const host=document.querySelector('#fa493-crest');
   return {fallback:host.dataset.clubCrestFallback,loaded:host.dataset.clubCrestLoaded??null,
    pending:host.dataset.clubCrestPending??null,images:host.querySelectorAll('img').length};
  });
  assert.equal(failed.fallback,'true','failed SVG may use the neutral fallback');
  assert.equal(failed.pending,null);
  assert.equal(failed.loaded,null);
  assert.equal(failed.images,0);
  record(harness,390,'real-dom-failed-svg','PASS',failed);
 }catch(error){record(harness,390,'real-dom-crest-lifecycle','FAIL',String(error));throw error;}
 finally{releaseCrest();await crestPage.close();}
 console.log('REPO-493 browser '+engine+': '+evidence.filter(e=>e.status==='PASS').length+
  ' PASS assertions; remaining matrix states UNKNOWN.');
}finally{
 mkdirSync('int24-browser-artifacts',{recursive:true});
 writeFileSync('int24-browser-artifacts/repo-493-first-paint-'+engine+'.json',
  JSON.stringify({issue:493,engine,sha:process.env.GITHUB_SHA||'local',scope:'risk-based sample only',evidence},null,2)+'\n');
 if(browser)await browser.close();
 server.closeAllConnections?.();
 await new Promise(resolve=>server.close(resolve));
}
