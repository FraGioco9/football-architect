// PERF-API-02 #734 — two bounded real-browser HTTP observations with
// synthetic public API payloads. Never use these as remote D1 benchmarks.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';

const origin='http://app.localhost:2000';
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',
 revision:15,seasonNumber:2,day:13,phase:'active'};
const player=id=>({id,display_name:'Synthetic QA Player '+id,
 first_name:'Synthetic',last_name:'Player',nationality:'ITA',
 primary_position:'CM',secondary_positions:[],age:24,height_cm:180,
 preferred_foot:'right',attributes:{},clubKey:null});
const api=(request)=>{const u=new URL(request.url());
 return request.method()==='GET'&&u.hostname==='app.localhost'&&u.pathname.startsWith('/api/');
};
const count=(rows,path,stage)=>rows.filter(r=>r.path===path&&(!stage||r.stage===stage)).length;
const save=(engine,kind,value)=>{
 mkdirSync('int24-browser-artifacts',{recursive:true});
 writeFileSync('int24-browser-artifacts/player-transport-734-'+kind+'-'+engine+'.json',
  JSON.stringify({scope:'Browser HTTP request starts; synthetic intercepted responses; no D1',...value},null,2)+'\n');
};
async function statsCase(browser,engine){
 const context=await browser.newContext({locale:'en',viewport:{width:390,height:844},
  reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),requests=[],errors=[];
 let stage='overview';
 page.on('pageerror',err=>errors.push(String(err.message)));
 page.on('request',req=>{if(api(req)){
  const u=new URL(req.url());requests.push({stage,path:u.pathname,query:u.search});
 }});
 try{
  await context.route('**/api/world',route=>route.fulfill({json:{world}}));
  await context.route('**/api/player/permissions',route=>route.fulfill({status:401,json:{}}));
  await context.route('**/api/players/7',route=>route.fulfill({json:{player:player(7)}}));
  await context.route('**/api/players/7/stats',route=>route.fulfill({
   json:{playerId:7,status:'empty',seasons:[]}
  }));
  const response=await page.goto(origin+'/players/7',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200,'public Player detail');
  await page.waitForFunction(()=>document.querySelector('[data-detail-name]')?.textContent?.includes('Synthetic QA Player 7'),
   null,{timeout:15000});
  assert.equal(count(requests,'/api/players/7'),1,'one profile GET');
  assert.equal(count(requests,'/api/players/7/stats'),0,'Overview is lazy, not eager Stats');
  stage='stats-cold';
  await page.locator('[data-detail-view="stats"]').click();
  await page.waitForFunction(()=>{
   const host=document.querySelector('[data-detail-stats]');
   const note=host?.querySelector('[data-detail-stats-note]');
   return host?.getAttribute('aria-busy')==='false'&&note&&!note.hidden&&note.textContent.trim();
  },null,{timeout:15000});
  assert.equal(count(requests,'/api/players/7/stats'),1,'first Stats entry fetches once');
  stage='stats-warm';
  await page.locator('[data-detail-view="info"]').click();
  await page.locator('[data-detail-view="stats"]').click();
  await page.waitForFunction(()=>document.documentElement.dataset.playerDetailView==='stats');
  assert.equal(count(requests,'/api/players/7/stats'),1,'warm Stats reuses verified response');
  await page.goBack({waitUntil:'commit'});
  await page.waitForFunction(()=>document.documentElement.dataset.playerDetailView==='info');
  await page.goForward({waitUntil:'commit'});
  await page.waitForFunction(()=>document.documentElement.dataset.playerDetailView==='stats');
  assert.equal(count(requests,'/api/players/7/stats'),1,'History Back/Forward stays local');
  assert.deepEqual(errors,[],'Player Stats has no JS page errors');
  return {engine,case:'public-player-stats',coldProfileGets:1,coldStatsGets:1,
   warmStatsGets:0,historyStatsGets:0,distinctPlayerFeatureRoutes:2,
   syntheticStatsBytes:Buffer.byteLength(JSON.stringify({playerId:7,status:'empty',seasons:[]})),
   requests};
 }finally{await context.close()}
}
async function directoryCase(browser,engine){
 const context=await browser.newContext({locale:'en',viewport:{width:1440,height:900},
  reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),requests=[],errors=[],responseBytes=[];
 let stage='initial';
 page.on('pageerror',err=>errors.push(String(err.message)));
 page.on('request',req=>{if(api(req)){
  const u=new URL(req.url());requests.push({stage,path:u.pathname,query:u.search});
 }});
 try{
  await context.addInitScript(()=>{
   // Stabilize manual pagination and classify native BFCache restores.
   window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
   if(location.pathname==='/players'){
    window.__faPlayerPageShows=[];
    window.addEventListener('pageshow',e=>window.__faPlayerPageShows.push(e.persisted));
    window.addEventListener('unload',()=>{}); // Encourage a real cold Back.
   }
  });
  // A no-store document makes Back exercise a newly parsed page where the
  // browser permits it; the observed pageshow value remains authoritative.
  await context.route(url=>url.hostname==='app.localhost'&&url.pathname==='/players',
   async route=>{
    const response=await route.fetch();
    await route.fulfill({response,headers:{...response.headers(),'cache-control':'no-store'}});
   });
  await context.route('**/api/world',route=>route.fulfill({json:{world}}));
  await context.route('**/api/player/permissions',route=>route.fulfill({status:401,json:{}}));
  await context.route('**/api/players/1',route=>route.fulfill({json:{player:player(1)}}));
  await context.route('**/api/players?*',route=>{
   const url=new URL(route.request().url()),offset=Number(url.searchParams.get('offset'));
   assert.ok([0,50,100].includes(offset),'bounded 50-player offsets');
   const players=Array.from({length:50},(_,i)=>player(offset+i+1));
   const payload={players,count:150,page:offset/50+1,pageSize:50,totalPages:3};
   responseBytes.push({stage,offset,bytes:Buffer.byteLength(JSON.stringify(payload))});
   return route.fulfill({json:payload});
  });
  const response=await page.goto(origin+'/players?view=overview',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200,'directory document');
  const loaded=n=>page.waitForFunction(expected=>
   document.querySelectorAll('.app-players-table tbody tr').length===expected&&
   !document.querySelector('.app-players-loading-row'),n,{timeout:15000});
  await loaded(50);
  assert.deepEqual(requests.filter(r=>r.path==='/api/players'&&r.stage==='initial')
   .map(r=>new URLSearchParams(r.query).get('offset')),['0']);
  stage='append';
  const more=page.locator('[data-players-load-more]');
  for(const n of [100,150]){
   await page.waitForFunction(()=>!document.querySelector('[data-players-load-more]')?.disabled);
   await more.evaluate(node=>node.click());
   await loaded(n);
  }
  assert.deepEqual(requests.filter(r=>r.path==='/api/players'&&r.stage==='append')
   .map(r=>new URLSearchParams(r.query).get('offset')),['50','100'],
   'exactly one offset GET per append');
  stage='detail';
  await page.locator('a.app-player-name-link[href="/players/1"]').first().click();
  await page.waitForURL(url=>url.pathname==='/players/1');
  await page.waitForFunction(()=>document.querySelector('[data-detail-name]')?.textContent?.includes('Synthetic QA Player 1'));
  stage='back';
  await page.goBack({waitUntil:'commit',timeout:30000});
  await page.waitForURL(url=>url.pathname==='/players');
  await loaded(150);
  const hit=await page.evaluate(()=>window.__faPlayerPageShows?.includes(true)===true);
  const offsets=requests.filter(r=>r.path==='/api/players'&&r.stage==='back')
   .map(r=>new URLSearchParams(r.query).get('offset'));
  // This classifies the actual browser outcome rather than claiming that
  // each browser always has a BFCache miss.
  assert.deepEqual(offsets,hit?[]:['0','50','100'],
   'BFCache hit keeps rows; cold Back replays three valid 50-player segments');
  assert.deepEqual(errors,[],'Player directory has no JS page errors');
  return {engine,case:'players-directory-back',bfcacheHit:hit,
   initialDirectoryGets:1,appendGets:2,returnDirectoryGets:offsets.length,
   distinctDirectoryApiRoutes:1,returnOffsets:offsets,
   syntheticApiBytes:responseBytes,requests};
 }finally{await context.close()}
}
export async function verifyPlayerTransport734(browser,{engine='chromium'}={}){
 const results=[];
 try{
  const stats=await statsCase(browser,engine);results.push(stats);
  const directory=await directoryCase(browser,engine);results.push(directory);
  console.log('PERF-API-02 '+engine+' Players Stats/Back HTTP evidence: '+JSON.stringify(
   results.map(({requests,syntheticApiBytes,...small})=>small)));
  return results.length;
 }finally{save(engine,'stats-back',{results})}
}
