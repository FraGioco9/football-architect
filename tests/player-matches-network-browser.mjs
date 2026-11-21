import assert from 'node:assert/strict';

// #734: browser-observed HTTP GETs against intercepted, synthetic public payloads.
// This verifies frontend transport, not a live D1/production latency benchmark.
export async function verifyPlayerMatchesNetwork(browser,{engine='chromium'}={}){
 const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:15,seasonNumber:2,day:13,phase:'active'};
 const measurements=[];
 for(const total of [73,103]){
  const context=await browser.newContext({locale:'en',viewport:{width:390,height:844}});
  const page=await context.newPage(),urls=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const items=Array.from({length:total},(_,i)=>({
   matchId:String(i+1),season:i<51?2:1,day:(i%56)+1,competitionId:'IT-1',
   clubId:'IT-1',opponentId:'IT-2',side:'home',venue:'home',
   result:{homeGoals:1,awayGoals:0},performance:{minutes:90,goals:0,assists:0,yellowCards:0,redCards:0,cleanSheets:null,rating:7.2}
  }));
  try{
   await page.route('**/api/world',route=>route.fulfill({json:{world}}));
   await page.route('**/api/players/7',route=>route.fulfill({json:{player:{id:7,display_name:'Synthetic QA Player',first_name:'Synthetic',last_name:'Player',nationality:'ITA',age:24,primary_position:'ST',secondary_positions:[],attributes:{}}}}));
   await page.route('**/api/players/7/matches?*',route=>{
    const url=new URL(route.request().url()),query=url.searchParams;
    assert.equal(query.get('limit'),'100','the real frontend sends the approved batch limit');
    assert.equal(query.get('season'),null);
    assert.equal(query.get('competition'),null);
    const cursor=query.get('cursor'),offset=cursor==='after-100'?100:0;
    assert.ok(cursor===null||cursor==='after-100','no unexpected cursor');
    urls.push(url.pathname+url.search);
    return route.fulfill({json:{schemaVersion:1,providerId:'authoritative-world',playerId:7,
     status:'available',world,total,filters:{seasons:[1,2],competitions:['IT-1']},
     items:items.slice(offset,offset+100),nextCursor:offset+100<total?'after-100':null}});
   });
   const response=await page.goto('http://app.localhost:2000/players/7?view=matches',{waitUntil:'domcontentloaded'});
   assert.equal(response?.status(),200);
   await page.locator('[data-player-matches-rows] [data-player-match-id]').first().waitFor({state:'attached',timeout:15000});
   await page.waitForFunction(()=>document.querySelector('[data-detail-matches]')?.getAttribute('aria-busy')==='false');
   const expected=Math.ceil(total/100);
   assert.equal(urls.length,expected,'real browser HTTP batch count for '+total+' appearances');
   assert.equal(await page.locator('[data-player-matches-rows] [data-player-match-id]').count(),20);
   await page.locator('[data-player-matches-more]').click();
   assert.equal(await page.locator('[data-player-matches-rows] [data-player-match-id]').count(),40);
   assert.equal(urls.length,expected,'Load more is purely local');
   await page.locator('[data-player-matches-season-control] .language-trigger').click();
   await page.locator('[data-player-matches-season-control] [data-menu-value="1"]').click();
   assert.equal(urls.length,expected,'season filters do not refetch');
   assert.deepEqual(errors,[],'no unhandled browser errors');
   measurements.push({appearances:total,httpGetCount:urls.length,distinctApiRoutes:new Set(urls.map(url=>url.split('?')[0])).size});
  }finally{await context.close()}
 }
 console.log('PERF-API-02 '+engine+' Player Matches browser HTTP evidence: '+JSON.stringify({mode:'synthetic intercepted API, no remote D1',measurements}));
 return measurements;
}
