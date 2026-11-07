// Shared SH-03 acceptance, invoked by both existing Chromium and WebKit FULL runners.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import calendarModel from '../assets/world-calendar-model.js';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:4,seasonNumber:2,day:20,phase:'active'};
const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
export function published(competitionId,selectedSeason,currentWorld){
 const def=manifest.competitions.find(c=>c.id===competitionId),ids=manifest.divisions.find(d=>d.id===competitionId).clubs.map(c=>c.countryId+'-'+c.clubId),ring=[...ids],fixtures=[];
 const days=calendarModel.createSeason(selectedSeason).days;
 for(let round=1;round<=15;round++){
  for(let i=0;i<8;i++)for(const [r,h,a] of [[round,ring[i],ring[15-i]],[round+15,ring[15-i],ring[i]]]){
   const marker='N'+String(r).padStart(2,'0'),day=days.find(d=>d.events.some(e=>e.marker===marker)).day;
   fixtures.push({id:`season:${selectedSeason}:${competitionId}:${marker}:${h}:${a}`,competitionId,day,round:r,marker,homeClubId:h,awayClubId:a,phaseId:'league',tieId:null,leg:null,neutral:false,
    result:day<=currentWorld.day?{homeGoals:0,awayGoals:0,resolution:'regulation',extraTime:null,penalties:null,winnerClubId:null}:null});
  }ring.splice(1,0,ring.pop());
 }
 const played=fixtures.filter(f=>f.result).length,clubPlayed=played/8;
 const row=id=>({clubId:id,played:clubPlayed,won:0,drawn:clubPlayed,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0});
 return {schemaVersion:1,providerId:'authoritative-world',competitionId,selectedSeason,world:currentWorld,status:'partial',reason:null,provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:`world:${currentWorld.generation}:season:${selectedSeason}:`+'a'.repeat(64)},data:{season:selectedSeason,seasonState:{day:currentWorld.day,phase:'active'},rulesVersion:def.rules.version,participants:ids,fixtures,
  standings:{complete:false,rows:ids.map((id,i)=>({...row(id),rank:i+1,points:clubPlayed}))},statistics:{matchesPlayed:played,totalGoals:0,goalsPerMatch:0,teams:ids.map(id=>({...row(id),cleanSheets:clubPlayed})),players:null,playerStatus:'unavailable'},
  calendar:days.map(d=>({day:d.day,fixtureIds:fixtures.filter(f=>f.day===d.day).map(f=>f.id),played:fixtures.filter(f=>f.day===d.day&&f.result).length})),history:null}};
}
export function calendarPublished(season,day,currentWorld){
 const catalog=manifest.divisions.flatMap(d=>d.clubs),competitions=manifest.competitions.map(c=>({id:c.id,rulesVersion:c.rules.version,clubIds:c.category==='domestic'?manifest.divisions.find(d=>d.id===c.id).clubs.map(c=>c.countryId+'-'+c.clubId):catalog.filter(club=>c.id==='int-1'?club.clubId<=3:club.clubId>=4&&club.clubId<=6).map(c=>c.countryId+'-'+c.clubId)}));
 const fixtures=manifest.divisions.flatMap(d=>published(d.id,season,currentWorld).data.fixtures.filter(f=>f.day===day));
 return {schemaVersion:1,providerId:'authoritative-world',scope:'calendar',selectedSeason:season,day,world:currentWorld,status:'partial',reason:null,provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:`world:${currentWorld.generation}:season:${season}:`+'a'.repeat(64)},data:{season,day,seasonState:{day:currentWorld.day,phase:'active'},calendarHash:'a'.repeat(64),rulesHash:'b'.repeat(64),competitions,fixtures}};
}
const routes=['/dashboard','/competitions','/competitions/it-1/standings?season=1','/competitions/int-1/stats?season=1','/calendar?season=1&calendarView=week','/clubs','/clubs/it/1/overview','/settings'];
const unavailable={kind:'none',sourceRef:null,resultAuthority:null};
const json=(route,status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
async function server(devPreview){
 const router=createPreviewServer({devPreview});
 const host=createServer((req,res)=>{req.headers.host='127.0.0.1:2000';router.emit('request',req,res)});
 host.listen(0,'127.0.0.1');await once(host,'listening');return host;
}
export async function verifyCanonicalStateBrowser(browser,engine){
 const publicHost=await server(false),debugHost=await server(true);
 const origin='http://127.0.0.1:'+publicHost.address().port,debugOrigin='http://127.0.0.1:'+debugHost.address().port;
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let offline=false,admin=false,worldCalls=0,holdSeasonOne=null,heldStarted=null,holdNumber='1',populated=false,apiWorld=world;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/world'){worldCalls++;return json(route,offline?503:200,offline?{}:{world:apiWorld})}
  if(path==='/api/admin/session'&&admin)return json(route,200,{actor:{id:'read-only-admin',email:'operator@example.invalid'},csrfToken:'a'.repeat(64)});
  if(path==='/api/player/permissions'&&admin)return json(route,200,{permissions:['admin.access','admin.world.read']});
  if(path==='/api/admin/world'&&admin)return json(route,200,{world:apiWorld});
  if(path==='/api/admin/seasons/events'&&admin)return json(route,503,{error:{code:'events-unavailable'}});
  const match=path.match(/^\/api\/competitions\/([^/]+)\/seasons\/(\d+)$/);
  if(match){
   const payload=populated&&match[1]==='IT-1'&&match[2]==='2'?published('IT-1',2,apiWorld):{schemaVersion:1,providerId:'authoritative-world',competitionId:match[1],selectedSeason:Number(match[2]),world:apiWorld,status:'empty',reason:'calendar-unpublished',data:null,provenance:unavailable};
   if(holdSeasonOne&&match[2]===holdNumber){heldStarted();await holdSeasonOne;}
   // Cancellation of the held request is expected when the user changes season.
   try{return await json(route,200,payload)}catch(error){if(!/closed|handled|cancel|invalid|intercept/i.test(error.message))throw error;return;}
  }
  const day=path.match(/^\/api\/calendar\/seasons\/(\d+)\/days\/(\d+)$/);
  if(day&&populated&&day[1]==='2'&&day[2]==='13')return json(route,200,calendarPublished(2,13,apiWorld));
  if(day)return json(route,200,{schemaVersion:1,providerId:'authoritative-world',scope:'calendar',selectedSeason:Number(day[1]),day:Number(day[2]),world:apiWorld,status:'empty',reason:'calendar-unpublished',data:null,provenance:unavailable});
  return json(route,401,{error:{code:'unauthorized'}});
 });
 await context.addInitScript(({debugPort})=>{
  let prefs={lang:'en',theme:'dark'};try{prefs=JSON.parse(window.name)||prefs}catch{}
  localStorage.setItem('football-architect:language',prefs.lang);localStorage.setItem('football-architect:theme',prefs.theme);
  if(sessionStorage.getItem('football-architect:standings-dev-season')===null)sessionStorage.setItem('football-architect:standings-dev-season',location.port===debugPort?'0':'4');
  if(sessionStorage.getItem('football-architect:calendar-dev-world-day')===null)sessionStorage.setItem('football-architect:calendar-dev-world-day','1');
 },{debugPort:String(debugHost.address().port)});
 let checks=0;
 const bounded=async(promise,label,ms=15000)=>{
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SH-03 timeout: '+label)),ms)})]);}
  finally{clearTimeout(timer)}
 };
 try{
  for(const [i,path] of routes.entries()){
   const width=[320,390,768,1440][i%4],lang=['en','de','es','fr','it'][i%5],theme=i%2?'light':'dark';
   await page.setViewportSize({width,height:844});
   await page.evaluate(({lang,theme})=>window.name=JSON.stringify({lang,theme}),{lang,theme});
   for(const refresh of [false,true]){
    if(refresh)await page.reload({waitUntil:'networkidle'});else await page.goto(origin+path,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.faWorldState?.get().world?.seasonNumber===2);
    const state=await page.evaluate(()=>({source:window.faWorldState.get().source,current:window.faWorldState.get().current,lang:document.documentElement.lang,theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth+2,calendar:document.getElementById('app-nav-calendar')?.getAttribute('href'),progress:document.querySelector('.fa-shell-date-full')?.textContent}));
    assert.equal(state.source,'authoritative',path);assert.deepEqual(state.current,{season:2,day:20});assert.ok(state.progress.includes('2')&&state.progress.includes('20/56'),path+' shared header progress');
    assert.equal(state.lang,lang);assert.equal(state.theme,theme);assert.equal(state.overflow,false,path+' overflow');
    assert.equal(new URL(state.calendar,origin).searchParams.get('season'),'2',path+' global sidebar');
    if(path.includes('?season=1'))assert.equal(new URL(page.url()).searchParams.get('season'),'1',path+' historical URL');
    checks++;
   }
  }
  // Read-only Admin uses the same world contract without granting any write capability.
  admin=true;await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('[data-admin-world]')?.textContent.includes('20'));
  assert.equal(await page.locator('[data-admin-prepare]').isEnabled(),false);checks++;
  apiWorld={...world,generation:'12345678-1234-4123-8123-123456789abc',revision:0,seasonNumber:0,day:0,phase:'unstarted'};
  await page.evaluate(()=>window.dispatchEvent(new Event('fa:world-invalidated')));
  await page.waitForFunction(()=>window.faWorldState?.get().world?.seasonNumber===0);
  await page.evaluate(()=>new Promise(resolve=>{document.documentElement.lang='it';requestAnimationFrame(resolve)}));
  assert.equal(await page.evaluate(()=>window.faWorldState.get().world.seasonNumber),0,'cached Admin render cannot undo a public reset');checks++;
  apiWorld=world;admin=false;
  await page.evaluate(()=>window.name=JSON.stringify({lang:'en',theme:'dark'}));
  // Empty public competition refresh must preserve loaded header/crest DOM and open menus.
  await page.goto(origin+'/competitions/it-1/standings?season=1',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.faCompetitionRoute?.get().season==='1'&&window.faWorldState?.get().current?.season===2);
  await page.locator('#app-competition-season').click();
  await page.evaluate(()=>{window.sh03Header=document.querySelector('.app-competition-header');window.sh03Picker=document.querySelector('#app-competition-season');window.dispatchEvent(new Event('fa:world-invalidated'))});
  await page.waitForFunction(()=>document.querySelector('.app-competition-status')?.textContent.includes('No published'));
  assert.equal(await page.locator('#app-competition-season').getAttribute('aria-expanded'),'true');
  assert.equal(await page.evaluate(()=>window.sh03Header===document.querySelector('.app-competition-header')&&window.sh03Picker===document.querySelector('#app-competition-season')),true);checks++;
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.faCompetitionRoute.set({view:'fixtures',season:'2',matchday:3}));
  await page.waitForURL('**/fixtures?season=2&matchday=3');
  await page.goBack();await page.waitForFunction(()=>window.faCompetitionRoute?.get().view==='standings'&&window.faCompetitionRoute?.get().season==='1');
  await page.goForward();await page.waitForFunction(()=>window.faCompetitionRoute?.get().view==='fixtures'&&window.faCompetitionRoute?.get().season==='2');checks++;
  let release;holdSeasonOne=new Promise(resolve=>release=resolve);const started=new Promise(resolve=>heldStarted=resolve);
  await page.goto(origin+'/competitions/it-1/standings?season=1',{waitUntil:'domcontentloaded'});await bounded(started,'held Season 1 API request');
  await page.evaluate(()=>window.faCompetitionRoute.set({season:'2'}));
  await page.waitForFunction(()=>window.faCompetitionContext?.selectedSeason===2);
  release();holdSeasonOne=null;await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>window.faCompetitionContext.selectedSeason),2);assert.equal(await page.evaluate(()=>window.faCompetitionContext.seasonData),null);checks++;
  await page.goto(origin+'/calendar?season=1&calendarView=week',{waitUntil:'networkidle'});
  await page.locator('#calendar-season-picker').click();
  await bounded(page.evaluate(()=>new Promise(resolve=>{window.sh03Option=document.querySelector('#calendar-season-menu [role=option]');window.addEventListener('fa:public-calendar-change',resolve,{once:true});window.dispatchEvent(new Event('focus'))})),'calendar menu refresh');
  assert.equal(await page.evaluate(()=>window.sh03Option===document.querySelector('#calendar-season-menu [role=option]')),true);
  assert.equal(await page.locator('#calendar-season-picker').getAttribute('aria-expanded'),'true');checks++;
  offline=true;
  await page.goto(origin+'/clubs/it/1/overview',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.faWorldState?.get().current===null&&document.documentElement.dataset.clubReady==='true');
  assert.ok((await page.locator('.club-header h1').textContent()).length>0);assert.equal(await page.locator('.club-tabs a').count(),5);checks++;
  offline=false;
  // Protected source ignores API data and retains its own empty Season 0 after reset/reload.
  const callsBefore=worldCalls;
  for(const path of routes){
   await page.goto(debugOrigin+path,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>window.faWorldState?.get().source==='dev');
   assert.deepEqual(await page.evaluate(()=>window.faWorldState.get().current),{season:0,day:0},'protected '+path);checks++;
  }
  assert.equal(worldCalls,callsBefore,'Debug pages must not read public world');
  await page.goto(debugOrigin+'/competitions/it-1/standings',{waitUntil:'networkidle'});
  await page.locator('.fa-dev-widget-button').click();
  await page.locator('[data-dev-control="season-number"]').fill('2');await page.locator('[data-dev-control="season-number"]').dispatchEvent('change');
  await page.waitForFunction(()=>window.faWorldState?.get().current?.season===2);
  await page.locator('[data-dev-control="reset-global"]').click();
  await page.waitForFunction(()=>window.faWorldState?.get().current?.season===0);
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>window.faWorldState.get().current.season),0);checks++;
  await page.locator('.fa-dev-widget-button').click();
  await page.locator('[data-dev-control="season-number"]').fill('2');await page.locator('[data-dev-control="season-number"]').dispatchEvent('change');
  await page.waitForFunction(()=>window.faWorldState?.get().current?.season===2);
  populated=true;
  const switcher=page.locator('[data-dev-control="debug-enabled"]');
  await switcher.uncheck();await page.waitForFunction(()=>window.faWorldState?.get().source==='authoritative'&&window.faWorldState.get().current?.season===2);
  await page.evaluate(()=>window.faCompetitionRoute.set({season:'2'}));
  await page.waitForFunction(()=>window.faCompetitionContext?.seasonData?.provenance?.kind==='authoritative');
  // Debug OFF must render the real partial-season table, including recent form.
  await page.waitForFunction(()=>document.querySelector('#app-standings-body tr')?.children[9]?.textContent?.trim()!=='—'&&
    document.querySelector('#app-standings-compact-list .app-world-mobile-position')?.textContent?.trim()!=='—');
  assert.equal(await page.locator('#app-standings-body tr').count(),16);
  assert.equal(await page.locator('#app-standings-compact-list li').count(),16);
  assert.ok(await page.locator('#app-standings-body tr .app-world-form-strip').count()>0,'published recent form');
  const viewportBefore=page.viewportSize();
  await page.setViewportSize({width:390,height:844});
  // A populated compact DOM may exist before the responsive shell is shown.
  // Measure only after the actual loaded mobile row is visible, not a hidden
  // 0px element; retain the exact 84px and 1px layout assertions below.
  await page.waitForFunction(()=>{
    const compact=document.getElementById('app-standings-compact');
    const row=document.querySelector('#app-standings-compact-list .app-world-mobile-summary');
    return !!row&&!compact?.hidden&&row.getClientRects().length>0&&
      getComputedStyle(row).display!=='none';
  },null,{timeout:10000});
  const heights=await page.evaluate(()=>{
    const loaded=document.querySelector('#app-standings-compact-list .app-world-mobile-summary');
    const pending=document.querySelector('.app-standings-skeleton .app-world-mobile-summary');
    const skeleton=pending.closest('.app-standings-skeleton');
    skeleton.style.display='block';
    const result=[loaded.getBoundingClientRect().height,pending.getBoundingClientRect().height];
    skeleton.style.removeProperty('display');return result;
  });
  assert.deepEqual(heights,[84,84],'mobile pending/loaded geometry must match');
  const alignment=await page.evaluate(()=>{
    const loaded=document.querySelector('#app-standings-compact-list .app-world-mobile-summary');
    const pending=document.querySelector('.app-standings-skeleton .app-world-mobile-summary');
    const shell=pending.closest('.app-standings-skeleton');
    shell.style.display='block';
    const measure=(root,selector)=>{
      // Skeleton keeps the known ID identity node in the DOM for resource
      // preloading, but it is hidden to prevent a false league ranking.
      // Compare only the actual displayed placeholder to the loaded row.
      const target=[...root.querySelectorAll(selector)].find(el=>
        el.getClientRects().length>0&&getComputedStyle(el).display!=='none');
      if(!target)throw Error('Missing visible standings item: '+selector);
      const box=target.getBoundingClientRect(),row=root.getBoundingClientRect();
      return {x:Math.round((box.left-row.left)*10)/10,y:Math.round((box.top-row.top)*10)/10};
    };
    const selectors=['.app-world-mobile-position','.app-world-mobile-name','.app-world-mobile-points','.app-world-mobile-form'];
    const delta=selectors.map(selector=>{
      const a=measure(loaded,selector),b=measure(pending,selector);
      return {selector,dx:Math.abs(a.x-b.x),dy:Math.abs(a.y-b.y)};
    });
    shell.style.removeProperty('display');return delta;
  });
  assert.ok(alignment.every(({dx,dy})=>dx<=1&&dy<=1),
    'mobile pending/loaded positions must match: '+JSON.stringify(alignment));
  const worldBeforeFocus=worldCalls;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal(worldCalls,worldBeforeFocus,'focus must not poll /api/world');
  // The DEV debug controls were opened earlier for the source transition.
  // Close their modal backdrop before interacting with the real view tabs.
  await page.locator('.fa-dev-widget-close').click();
  await page.waitForFunction(()=>document.querySelector('.fa-dev-widget-backdrop')?.hidden===true);
  const worldBeforeTabs=worldCalls;
  await page.locator('#competition-tab-fixtures').click();
  await page.locator('#competition-tab-stats').click();
  await page.locator('#competition-tab-standings').click();
  assert.equal(worldCalls,worldBeforeTabs,'in-page tab switch must not poll /api/world');
  await page.setViewportSize(viewportBefore);
  await page.evaluate(()=>{window.sh03Row=document.querySelector('#app-standings-body tr');window.sh03DocumentToken={};window.dispatchEvent(new Event('fa:world-invalidated'))});
  await page.waitForFunction(()=>document.querySelector('.app-competition-status')?.hidden===true);
  assert.equal(await page.evaluate(()=>window.sh03Row===document.querySelector('#app-standings-body tr')),true,'populated refresh retains rows');
  holdNumber='2';let releaseOld;holdSeasonOne=new Promise(resolve=>releaseOld=resolve);const oldStarted=new Promise(resolve=>heldStarted=resolve);
  // A same-revision world invalidation no longer refetches the season.
  // Advance world revision deliberately to exercise a genuinely stale in-flight read.
  apiWorld={...world,revision:5,day:21};
  await page.evaluate(()=>window.dispatchEvent(new Event('fa:world-invalidated')));
  await bounded(oldStarted,'season read after world revision advances');
  // Reopen the controls only for the following Debug ON/OFF checks.
  await page.locator('.fa-dev-widget-button').click();
  await switcher.check();await page.waitForFunction(()=>window.faWorldState?.get().source==='dev'&&window.faWorldState.get().current?.season===2);
  assert.notEqual(await page.evaluate(()=>window.faCompetitionContext?.seasonData?.provenance?.kind),'authoritative','ON clears API sporting data');
  apiWorld={...world,revision:6,day:22};
  await switcher.uncheck();await page.waitForFunction(()=>window.faWorldState?.get().current?.day===22);
  assert.equal(new URL(page.url()).searchParams.get('season'),'2','OFF retains viewed season');
  releaseOld();holdSeasonOne=null;await page.waitForFunction(()=>window.faCompetitionContext?.seasonData?.world?.revision===6);
  assert.equal(await page.evaluate(()=>!!window.sh03DocumentToken),true,'switches preserve the document');checks++;
  await page.goto(debugOrigin+'/calendar?season=2&calendarView=week',{waitUntil:'networkidle'});
  await page.evaluate(()=>window.faWorldCalendar.setWeek(2));
  await page.locator('[data-calendar-day="13"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#calendar-event-dialog [data-authoritative-calendar] li').length===128);
  await bounded(page.evaluate(()=>new Promise(resolve=>{window.sh03Dialog=document.getElementById('calendar-event-dialog');window.sh03Fixture=document.querySelector('#calendar-event-dialog [data-authoritative-calendar] li');window.addEventListener('fa:public-calendar-change',resolve,{once:true});window.dispatchEvent(new Event('focus'))})),'calendar dialog refresh');
  assert.equal(await page.evaluate(()=>window.sh03Dialog.open&&window.sh03Fixture===document.querySelector('#calendar-event-dialog [data-authoritative-calendar] li')),true,'open populated calendar dialog survives refresh');checks++;
  await page.screenshot({path:'int24-browser-artifacts/sh03-'+engine+'-calendar-dialog.png',fullPage:true});
  // Cold navigation: one shared global read plus one post-season revision
  // check. The second GET protects against cross-session world resets.
  const coldWorldCalls=worldCalls;
  await page.goto(origin+'/competitions/it-1/standings?season=2',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.faCompetitionContext?.seasonData?.provenance?.kind==='authoritative');
  assert.equal(worldCalls-coldWorldCalls,2,'two world checks: canonical bootstrap and post-season reset fence');
  const beforeTab=worldCalls;
  await page.locator('#competition-tab-fixtures').click();
  await page.locator('#competition-tab-standings').click();
  assert.equal(worldCalls,beforeTab,'in-page competition tabs must not reload /api/world');
  checks++;
  assert.deepEqual(errors,[],engine+' SH-03 browser errors');
  console.log('SH-03 '+engine+' PASS: '+checks+' individual page/state checks');
 }catch(error){
  const snapshot=await page.evaluate(()=>({url:location.href,world:window.faWorldState?.get?.(),route:window.faCompetitionRoute?.get?.(),context:{season:window.faCompetitionContext?.selectedSeason,world:window.faCompetitionContext?.seasonData?.world},status:document.querySelector('.app-competition-status')?.textContent,admin:document.querySelector('[data-admin-status]')?.textContent})).catch(()=>null);
  console.error('SH-03 failure state: '+JSON.stringify({engine,snapshot,errors}));
  await page.screenshot({path:'int24-browser-artifacts/sh03-'+engine+'-failure.png',fullPage:true}).catch(()=>{});throw error;
 }finally{
  await context.close();for(const host of [publicHost,debugHost]){host.closeAllConnections();await new Promise(resolve=>host.close(resolve));}
 }
}
