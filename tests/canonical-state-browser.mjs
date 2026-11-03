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
// PAGE-LOAD-02: each concrete page/view is navigated independently in both engines.
// This smoke grid complements (but does not replace) per-view delayed/error QA.
const routes=[
 '/dashboard','/competitions',
 '/competitions/it-1/overview?season=1',
 '/competitions/it-1/standings?season=1',
 '/competitions/it-1/fixtures?season=1&matchday=3',
 '/competitions/it-1/stats?season=1',
 '/competitions/it-1/history?season=1',
 '/competitions/it-1/rules?season=1',
 '/competitions/it-1/awards?season=1',
 '/competitions/int-1/postseason?season=1',
 '/competitions/int-1/standings?season=1',
 '/competitions/int-1/fixtures?season=1&matchday=1',
 '/competitions/int-1/stats?season=1',
 '/competitions/int-1/history?season=1',
 '/competitions/int-1/rules?season=1',
 '/calendar?season=1&calendarView=season',
 '/calendar?season=1&calendarView=week',
 '/clubs',
 '/clubs/it/1/overview',
 '/clubs/it/1/roster',
 '/clubs/it/1/fixtures',
 '/clubs/it/1/stats',
 '/clubs/it/1/history',
 '/settings'
];
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
 const errors=[];page.on('pageerror',error=>errors.push(error.stack||error.message));
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
    // PAGE-LOAD-02: each individual view, not just a sibling route, must
    // remain within the viewport at all four supported breakpoints.
    if(refresh){
     for(const probe of [320,390,768,1440]){
      await page.setViewportSize({width:probe,height:844});
      const geometry=await page.evaluate(()=>({
       overflow:document.documentElement.scrollWidth>innerWidth+2,
       headings:document.querySelectorAll('h1').length
      }));
      assert.equal(geometry.overflow,false,path+' horizontal overflow at '+probe);
      assert.ok(geometry.headings>=1,path+' missing static title at '+probe);
      checks++;
     }
     await page.setViewportSize({width,height:844});
    }
    checks++;
   }
  }
  // Read-only Admin uses the same world contract without granting any write capability.
  admin=true;await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('[data-admin-world]')?.textContent.includes('20'));
  assert.equal(await page.locator('[data-admin-prepare]').isEnabled(),false);checks++;
  apiWorld={...world,generation:'12345678-1234-4123-8123-123456789abc',revision:0,seasonNumber:0,day:0,phase:'unstarted'};
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>window.faWorldState?.get().world?.seasonNumber===0);
  await page.evaluate(()=>new Promise(resolve=>{document.documentElement.lang='it';requestAnimationFrame(resolve)}));
  assert.equal(await page.evaluate(()=>window.faWorldState.get().world.seasonNumber),0,'cached Admin render cannot undo a public reset');checks++;
  apiWorld=world;admin=false;
  await page.evaluate(()=>window.name=JSON.stringify({lang:'en',theme:'dark'}));
  // Empty public competition refresh must preserve loaded header/crest DOM and open menus.
  await page.goto(origin+'/competitions/it-1/standings?season=1',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.faCompetitionRoute?.get().season==='1'&&window.faWorldState?.get().current?.season===2);
  await page.locator('#app-competition-season').click();
  await page.evaluate(()=>{window.sh03Header=document.querySelector('.app-competition-header');window.sh03Picker=document.querySelector('#app-competition-season');window.dispatchEvent(new Event('focus'))});
  await page.waitForFunction(()=>document.querySelector('.app-competition-status')?.textContent.includes('No published'));
  assert.equal(await page.locator('#app-competition-season').getAttribute('aria-expanded'),'true');
  assert.equal(await page.evaluate(()=>window.sh03Header===document.querySelector('.app-competition-header')&&window.sh03Picker===document.querySelector('#app-competition-season')),true);checks++;
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.faCompetitionRoute.set({view:'fixtures',season:'2',matchday:3}));
  await page.waitForURL('**/fixtures?season=2&matchday=3');
  await page.goBack();await page.waitForFunction(()=>window.faCompetitionRoute?.get().view==='standings'&&window.faCompetitionRoute?.get().season==='1');
  await page.goForward();await page.waitForFunction(()=>window.faCompetitionRoute?.get().view==='fixtures'&&window.faCompetitionRoute?.get().season==='2');checks++;
  let release;holdSeasonOne=new Promise(resolve=>release=resolve);const started=new Promise(resolve=>heldStarted=resolve);
  await page.goto(origin+'/competitions/it-1/standings?season=1',{waitUntil:'domcontentloaded'});await started;
  await page.evaluate(()=>window.faCompetitionRoute.set({season:'2'}));
  await page.waitForFunction(()=>window.faCompetitionContext?.selectedSeason===2);
  release();holdSeasonOne=null;await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>window.faCompetitionContext.selectedSeason),2);assert.equal(await page.evaluate(()=>window.faCompetitionContext.seasonData),null);checks++;
  await page.goto(origin+'/calendar?season=1&calendarView=week',{waitUntil:'networkidle'});
  await page.locator('#calendar-season-picker').click();
  await page.evaluate(()=>new Promise(resolve=>{window.sh03Option=document.querySelector('#calendar-season-menu [role=option]');window.addEventListener('fa:public-calendar-change',resolve,{once:true});window.dispatchEvent(new Event('focus'))}));
  assert.equal(await page.evaluate(()=>window.sh03Option===document.querySelector('#calendar-season-menu [role=option]')),true);
  assert.equal(await page.locator('#calendar-season-picker').getAttribute('aria-expanded'),'true');checks++;
  offline=true;
  await page.goto(origin+'/clubs/it/1/overview',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.faWorldState?.get().current===null&&document.documentElement.dataset.clubReady==='true');
  assert.ok((await page.locator('.club-header h1').textContent()).length>0);assert.equal(await page.locator('.club-tabs a').count(),5);checks++;
  // PAGE-LOAD-02 P17/P18: independently check club image/focus preservation.
  await page.waitForFunction(()=>document.querySelector('.club-header [data-club-crest] .app-club-crest-image')?.complete);
  await page.evaluate(()=>{window.p17Crest=document.querySelector('.club-header [data-club-crest] .app-club-crest-image');window.p17Header=document.querySelector('.club-header')});
  for(const lang of ['de','es','fr','it','en']){
   await page.locator('.club-tabs [aria-current="page"]').focus();
   await page.evaluate(value=>document.documentElement.lang=value,lang);
   await page.waitForFunction(value=>document.title.includes(window.faClubModel.copies[value].overview),lang);
   assert.equal(await page.evaluate(()=>document.querySelector('.club-header [data-club-crest] .app-club-crest-image')===window.p17Crest),true,'P17 crest identity '+lang);
   assert.equal(await page.evaluate(()=>document.activeElement?.matches('.club-tabs [aria-current="page"]')),true,'P17 focused tab '+lang);
   checks++;
  }
  // Capture the current translated header: earlier language switches
  // intentionally replaced its text and its wrapper.
  await page.evaluate(()=>{window.p17Header=document.querySelector('.club-header')});
  await page.locator('.club-tabs a[href*="/fixtures"]').click();
  await page.waitForURL('**/fixtures*');
  assert.equal(await page.evaluate(()=>document.querySelector('.club-header')===window.p17Header),true,'P18 header survives tab navigation');
  await page.goBack();
  await page.waitForURL('**/overview*');
  assert.equal(await page.evaluate(()=>document.querySelector('.club-header')===window.p17Header),true,'P18 header survives Back');
  checks++;
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
  await page.evaluate(()=>{window.sh03Row=document.querySelector('#app-standings-body tr');window.sh03DocumentToken={};window.dispatchEvent(new Event('focus'))});
  await page.waitForFunction(()=>document.querySelector('.app-competition-status')?.hidden===true);
  assert.equal(await page.evaluate(()=>window.sh03Row===document.querySelector('#app-standings-body tr')),true,'populated refresh retains rows');
  holdNumber='2';let releaseOld;holdSeasonOne=new Promise(resolve=>releaseOld=resolve);const oldStarted=new Promise(resolve=>heldStarted=resolve);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await oldStarted;
  await switcher.check();await page.waitForFunction(()=>window.faWorldState?.get().source==='dev'&&window.faWorldState.get().current?.season===2);
  assert.notEqual(await page.evaluate(()=>window.faCompetitionContext?.seasonData?.provenance?.kind),'authoritative','ON clears API sporting data');
  apiWorld={...world,revision:5,day:21};
  await switcher.uncheck();await page.waitForFunction(()=>window.faWorldState?.get().current?.day===21);
  assert.equal(new URL(page.url()).searchParams.get('season'),'2','OFF retains viewed season');
  releaseOld();holdSeasonOne=null;await page.waitForFunction(()=>window.faCompetitionContext?.seasonData?.world?.revision===5);
  assert.equal(await page.evaluate(()=>!!window.sh03DocumentToken),true,'switches preserve the document');
  // PAGE-LOAD-02 P04: changing sources may clear incompatible sporting rows;
  // consecutive validated revisions of the same source must retain stable rows.
  await page.waitForFunction(()=>document.querySelectorAll('#app-standings-body tr[data-world-club]').length===16);
  await page.evaluate(()=>{
   window.p04Row=document.querySelector('#app-standings-body tr');
   window.p04Before={club:window.p04Row.dataset.worldClub,rows:document.querySelectorAll('#app-standings-body tr[data-world-club]').length};
  });
  apiWorld={...world,revision:6,day:22};
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>window.faCompetitionContext?.seasonData?.world?.revision===6);
  const p04=await page.evaluate(()=>({
   row:window.p04Row===document.querySelector('#app-standings-body tr'),
   count:document.querySelectorAll('#app-standings-body tr[data-world-club]').length,
   crest:document.querySelector('#app-standings-body tr [data-club-crest]')?.dataset.clubCrest,
   provenance:window.faCompetitionContext?.seasonData?.provenance?.kind,
   afterClub:document.querySelector('#app-standings-body tr')?.dataset.worldClub,
   before:window.p04Before,
   sourceState:document.querySelector('.app-competition-status')?.textContent
  }));
  assert.equal(p04.count,16,'P04 valid standings rows: '+JSON.stringify(p04));
  assert.equal(p04.row,true,'P04 preserve club row identity: '+JSON.stringify(p04));
  assert.ok(p04.crest,'P04 retained known crest identity');
  assert.equal(p04.provenance,'authoritative');
  checks+=2;
  await page.goto(debugOrigin+'/calendar?season=2&calendarView=week',{waitUntil:'networkidle'});
  await page.evaluate(()=>window.faWorldCalendar.setWeek(2));
  await page.locator('[data-calendar-day="13"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#calendar-event-dialog [data-authoritative-calendar] li').length===128);
  await page.evaluate(()=>new Promise(resolve=>{window.sh03Dialog=document.getElementById('calendar-event-dialog');window.sh03Fixture=document.querySelector('#calendar-event-dialog [data-authoritative-calendar] li');window.addEventListener('fa:public-calendar-change',resolve,{once:true});window.dispatchEvent(new Event('focus'))}));
  assert.equal(await page.evaluate(()=>window.sh03Dialog.open&&window.sh03Fixture===document.querySelector('#calendar-event-dialog [data-authoritative-calendar] li')),true,'open populated calendar dialog survives refresh');checks++;
  await page.screenshot({path:'int24-browser-artifacts/sh03-'+engine+'-calendar-dialog.png',fullPage:true});
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
