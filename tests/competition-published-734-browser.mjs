// PERF-API-02 (#734): real browser request count, intercepted synthetic data only.
// This is not remote D1/production byte, compression or latency evidence.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {published} from './canonical-state-browser.mjs';

const origin='http://app.localhost:2000';
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',
 revision:4,seasonNumber:1,day:20,phase:'active'};
const seasonRoute='/api/competitions/IT-1/seasons/1';
const matchRoute='/api/matches/seasons/1/competitions/IT-1';
const seasonPayload=published('IT-1',1,world);
const emptyPayload={schemaVersion:1,providerId:'authoritative-world',
 competitionId:'IT-1',selectedSeason:1,world,status:'empty',reason:'calendar-unpublished',
 data:null,provenance:{kind:'none',sourceRef:null,resultAuthority:null}};
const games=seasonPayload.data.fixtures.map((f,i)=>({
 matchId:String(1000+i),sourceFixtureId:f.id,marker:f.marker,day:f.day,
 round:f.round,phaseId:'league',homeClubId:f.homeClubId,awayClubId:f.awayClubId,venue:null
}));
const brackets=[1,2].map(leg=>({matchId:String(1300+leg),sourceFixtureId:null,
 marker:'PLAYOUT',day:50+leg,round:31,phaseId:'playout',tieId:'playout-13-14',
 leg,homeClubId:null,awayClubId:null,venue:null,
 participantA:{kind:'rank',rank:13},participantB:{kind:'rank',rank:14}}));
const matchPayload={schemaVersion:1,providerId:'authoritative-world',season:1,
 competitionId:'IT-1',status:'published',fixtures:[...games,...brackets],
 provenance:{kind:'authoritative',sourceKind:'synthetic-test',sourceHash:'a'.repeat(64)}};
const bytes=value=>Buffer.byteLength(JSON.stringify(value));
const scenarios=[
 {name:'fixtures-published',view:'fixtures',empty:false},
 {name:'stats-then-fixtures',view:'stats',empty:false},
 {name:'fixtures-early-draw',view:'fixtures',empty:true}
];

export async function verifyCompetitionPublishedNetwork(browser,{engine='chromium'}={}){
 const observations=[];
 for(const spec of scenarios){
  const context=await browser.newContext({viewport:{width:390,height:844},
   reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage(),requests=[],errors=[];
  let phase='cold';
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
   const u=new URL(request.url());
   if(u.origin===origin&&u.pathname.startsWith('/api/'))
    requests.push({phase,method:request.method(),path:u.pathname,query:u.search});
  });
  const season=spec.empty?emptyPayload:seasonPayload;
  try{
   await context.addInitScript(()=>{
    sessionStorage.setItem('football-architect:debug-enabled','off');
   });
   await page.route('**/api/**',route=>{
    const u=new URL(route.request().url());
    const payload=u.pathname==='/api/world'?{world}:
     u.pathname===seasonRoute?season:
     u.pathname===matchRoute?matchPayload:null;
    return route.fulfill({status:payload?200:401,contentType:'application/json',
     body:JSON.stringify(payload??{error:{code:'unauthorized'}})});
   });
   const waitFor=path=>page.waitForResponse(response=>
    new URL(response.url()).pathname===path&&response.status()===200,{timeout:16000});
   const seasonReady=waitFor(seasonRoute);
   const publishedReady=spec.view==='fixtures'?waitFor(matchRoute):null;
   const response=await page.goto(origin+'/competitions/it-1/'+spec.view+'?season=1',
    {waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(response?.status(),200,'competition document '+spec.name);
   await seasonReady;
   if(publishedReady)await publishedReady;
   await page.waitForFunction(()=>window.faWorldState?.get?.().worldStatus==='ready',
    null,{timeout:16000});
   await page.waitForTimeout(300);
   const count=(stage,path)=>requests.filter(r=>r.phase===stage&&r.method==='GET'&&r.path===path).length;
   const coldSeason=count('cold',seasonRoute);
   const coldMatch=count('cold',matchRoute);
   assert.equal(coldSeason,1,'one cold sporting read '+spec.name);
   assert.equal(coldMatch,spec.view==='fixtures'?1:0,
    'published index only on link-enabled view '+spec.name);
   let onView=0,warm=0;
   if(spec.view==='stats'){
    phase='switch';
    const switching=waitFor(matchRoute);
    await page.evaluate(()=>window.faCompetitionRoute.set({view:'fixtures'}));
    await switching;
    onView=count('switch',matchRoute);
    assert.equal(onView,1,'one index GET after Stats→Fixtures');
   }
   // One verified same-world index remains available across client-side tab switches.
   phase='warm';
   await page.evaluate(()=>window.faCompetitionRoute.set({view:'stats'}));
   await page.waitForFunction(()=>window.faCompetitionRoute?.get?.().view==='stats');
   await page.evaluate(()=>window.faCompetitionRoute.set({view:'fixtures'}));
   await page.waitForFunction(()=>window.faCompetitionRoute?.get?.().view==='fixtures');
   await page.waitForTimeout(350);
   warm=count('warm',matchRoute);
   assert.equal(warm,0,'same-world Fixtures tab return reuses index '+spec.name);
   assert.deepEqual(errors,[],'no browser JS errors '+spec.name);
   observations.push({engine,scenario:spec.name,
    cold:{seasonGets:coldSeason,publishedIndexGets:coldMatch},
    statsToFixturesPublishedGets:onView,warmReturnPublishedGets:warm,
    publishedMatches:matchPayload.fixtures.length,
    syntheticResponseBytes:{sportingSeason:bytes(season),publishedIndex:bytes(matchPayload)},
    apiRequests:requests});
  }finally{await context.close()}
 }
 mkdirSync('int24-browser-artifacts',{recursive:true});
 writeFileSync('int24-browser-artifacts/competition-published-734-'+engine+'.json',
  JSON.stringify({scope:'real browser requests; intercepted synthetic API bodies, not hosted D1',
   observations},null,2)+'\n');
 console.log('PERF-API-02 '+engine+' Competition published-ID network evidence: '+
  JSON.stringify(observations.map(({apiRequests,...rest})=>rest)));
 return observations.length;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {webkit}=await import('playwright');
 const browser=await webkit.launch({headless:true});
 try{await verifyCompetitionPublishedNetwork(browser,{engine:'webkit'});}
 finally{await browser.close()}
}
