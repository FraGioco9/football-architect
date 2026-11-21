// PERF-API-02 (#734): browser network evidence for Club BFCache return.
// Synthetic, intercepted public API payloads: this is not a production / D1 latency benchmark.
// This is a read-only measurement; no product code or cache behavior is changed.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {published} from './canonical-state-browser.mjs';

const origin='http://app.localhost:2000';
const generation='550e8400-e29b-41d4-a716-446655440000';
const world={schemaVersion:1,generation,revision:4,seasonNumber:1,day:16,phase:'active'};
const rosterPath='/api/clubs/IT-1/roster';
const fixturePath='/api/clubs/IT-1/seasons/1/fixtures';

export async function verifyClubBfcacheNetwork(browser,{engine='chromium'}={}){
 const canonical=published('IT-1',1,world);
 const fixtures=canonical.data.fixtures
  .filter(f=>f.homeClubId==='IT-1'||f.awayClubId==='IT-1')
  .map((fixture,index)=>({...fixture,matchId:String(index+1001)}));
 assert.equal(fixtures.length,30,'bounded published club fixture projection');
 const payloads=new Map([
  ['/api/world',{world}],
  [rosterPath,{schemaVersion:1,clubKey:'IT-1',count:1,players:[{
   id:1001,display_name:'Synthetic Club Player',nationality:'ITA',primary_position:'CM',
   secondary_positions:[],age:23,height_cm:178,preferred_foot:'right',attributes:{}
  }]}],
  [fixturePath,{schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',
   selectedSeason:1,world,status:'partial',reason:null,
   provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1',
    sourceRef:'club-fixtures:'+generation+':season:1:'+'a'.repeat(64)},
   data:{season:1,seasonState:canonical.data.seasonState,competitions:['IT-1'],fixtures}}]
 ]);
 const context=await browser.newContext({viewport:{width:390,height:844},
  locale:'en',reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage();
 const observed=[],errors=[],results=[];
 let stage='setup';
 page.on('pageerror',error=>errors.push(String(error.message)));
 page.on('request',request=>{
  const url=new URL(request.url());
  if(url.origin!==origin||!url.pathname.startsWith('/api/'))return;
  observed.push({stage,method:request.method(),path:url.pathname,query:url.search});
 });
 try{
  await context.addInitScript(()=>{
   sessionStorage.setItem('football-architect:debug-enabled','off');
   window.__faBfcachePageshow=[];
   window.addEventListener('pageshow',event=>window.__faBfcachePageshow.push(event.persisted));
  });
  await page.route('**/api/player/permissions',route=>route.fulfill({
   status:401,contentType:'application/json',body:'{}'
  }));
  for(const [path,payload] of payloads){
   const body=JSON.stringify(payload);
   await page.route('**'+path,route=>route.fulfill({
    status:200,contentType:'application/json',body
   }));
  }
  const count=(part,kind)=>observed.filter(r=>r.stage===part&&r.method==='GET'&&r.path===kind).length;
  const scenarios=[
   {name:'roster',route:'/clubs/it/1/roster?view=info',api:rosterPath,
    ready:()=>!!document.querySelector('.club-roster[aria-busy="false"] .club-roster-table')},
   {name:'fixtures',route:'/clubs/it/1/fixtures?season=1',api:fixturePath,
    ready:()=>document.querySelectorAll('[data-club-fixture-id]').length===30}
  ];
  for(const scenario of scenarios){
   stage=scenario.name+'-cold';
   const first=await page.goto(origin+scenario.route,{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(first?.status(),200,scenario.name+' document');
   await page.waitForFunction(scenario.ready,null,{timeout:15000});
   await page.waitForFunction(()=>window.faWorldState?.get?.().worldStatus==='ready',null,{timeout:15000});
   const cold=count(stage,scenario.api);
   assert.equal(cold,1,scenario.name+' cold feature endpoint GET');
   stage=scenario.name+'-away';
   const away=await page.goto(origin+'/dashboard',{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(away?.status(),200,'dashboard document');
   stage=scenario.name+'-back';
   await page.goBack({waitUntil:'commit',timeout:30000});
   await page.waitForURL(url=>url.pathname===new URL(scenario.route,origin).pathname);
   await page.waitForFunction(scenario.ready,null,{timeout:15000});
   await page.waitForFunction(()=>window.faWorldState?.get?.().worldStatus==='ready',null,{timeout:15000});
   // Allow a deferred world-revision listener to initiate a feature GET.
   await page.waitForTimeout(300);
   const bfcacheEvents=await page.evaluate(()=>window.__faBfcachePageshow||[]);
   results.push({
    view:scenario.name,engine,documentRoute:scenario.route,
    bfcacheHit:bfcacheEvents.includes(true),
    coldFeatureGets:cold,returnFeatureGets:count(stage,scenario.api),
    featureRoute:scenario.api,distinctFeatureRoutes:1,
    syntheticFeatureResponseBytes:Buffer.byteLength(JSON.stringify(payloads.get(scenario.api))),
    returnWorldGets:count(stage,'/api/world')
   });
  }
  assert.deepEqual(errors,[],'no Club browser page errors');
 }finally{
  mkdirSync('int24-browser-artifacts',{recursive:true});
  writeFileSync('int24-browser-artifacts/club-bfcache-'+engine+'.json',
   JSON.stringify({scope:'real browser requests, intercepted synthetic responses (no remote D1)',
    world,results,apiRequests:observed},null,2)+'\n');
  await context.close();
 }
 console.log('PERF-API-02 '+engine+' Club BFCache browser GET evidence: '+JSON.stringify(results));
 return results.length;
}

// FULL CI runs this narrow probe in WebKit without repeating the 20-case area matrix.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {webkit}=await import('playwright');
 const browser=await webkit.launch({headless:true});
 try{await verifyClubBfcacheNetwork(browser,{engine:'webkit'});}finally{await browser.close();}
}
