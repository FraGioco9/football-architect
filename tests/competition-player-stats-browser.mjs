// #643: isolated presentation fixtures, no remote DB or sporting writes.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

export async function verifyCompetitionPlayerStats(browser,{engine='chromium'}={}){
 let checks=0;
 for(const id of ['it-1','int-1','int-2'])for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],playerRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/players'))playerRequests.push(request.url())});
  try{
   await page.addInitScript(width=>{
    localStorage.setItem('football-architect:language',width===390?'it':'en');
    localStorage.setItem('football-architect:theme',width===390?'light':'dark');
   },width);
   // The public world is explicitly unavailable; fixtures below are supplied
   // only to the presentation API after its asynchronous reader is suspended.
   await page.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.goto('http://app.localhost:2000/competitions/'+id+'/stats?season=1',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.faCompetitionContextApi&&window.faCompetitionContext?.selectedSeason===1&&window.faCompetitionStats);
   assert.equal(await page.evaluate(()=>{window.faDevPreviewMode=true;return window.faCompetitionContextApi.setDebugSeason(1)}),true);
   await page.evaluate(()=>{
    const c=window.faCompetitionContext,capacity=c.definition.capacity,countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
    const participants=Array.from({length:capacity},(_,i)=>({countryId:capacity===16?'IT':countries[Math.floor(i/3)],clubId:capacity===16?i+1:i%3+1,primaryName:'QA Club '+(i+1)}));
    const teams=participants.map(club=>({clubKey:club.countryId+'-'+club.clubId,clubName:club.primaryName,mp:1,gf:1,ga:1,w:0,cs:0,ppg:1,gd:0,unbeatenStreak:1}));
    const data={season:1,rulesVersion:c.definition.rules.version,participants,fixtures:[],results:[],status:'partial',provenance:{kind:'authoritative',sourceRef:'isolated-browser-fixture'},statistics:{standings:[],overview:{matchesPlayed:8,totalGoals:16,goalsPerMatch:2},teams,players:[]}};
    window.__stats643Data=data;
    window.__stats643Supply=mode=>{
     const next=structuredClone(data);
     next.statistics.players=mode==='fallback'?[]:Array.from({length:mode==='mixed'?11:22},(_,i)=>({playerId:i+1,name:i===0?null:'QA Player '+String(i+1).padStart(2,'0'),clubKey:mode==='mixed'||i<11?'IT-1':'IT-2',appearances:1,starts:1,minutes:i===0?75:90,goals:i===1?2:i<8?1:0}));
     if(mode==='no-games'){next.statistics.players=[];next.statistics.overview={matchesPlayed:0,totalGoals:0,goalsPerMatch:0};}
     if(mode==='archive'){next.seasonState={day:56,phase:'closed'};next.status='available';next.statistics.players=[{playerId:58,name:'Archived Player',clubKey:'IT-1',appearances:30,starts:30,minutes:2700,goals:2,averageRating:6.75,ratedAppearances:20,cleanSheets:10}];}
     if(!window.faCompetitionContextApi.replaceSeasonData(next,window.faCompetitionContext.revision))throw Error('Stats fixture rejected');
    };
    window.__stats643Supply('real');
   });
   await page.locator('#fa-dev-stats [data-stats-view="players"]').click();
   const cards=page.locator('#fa-dev-stats .fa-dev-stats-leader-card');
   const goals=cards.filter({has:page.locator('[data-app-i18n="statsDevGoals"]')});
   assert.equal(await cards.count(),8);
   assert.deepEqual(await cards.locator('h4').evaluateAll(nodes=>nodes.map(n=>n.dataset.appI18n)),['statsDevAverageRating','statsDevGoals','statsDevAssists','statsDevGoalsAssists90','statsDevCleanSheets','statsDevStartsSubstitutes','statsDevRedCards','statsDevMinutes']);
   assert.equal(await goals.locator('li strong').first().textContent(),'2');
   assert.equal(await goals.locator('li strong').nth(1).textContent(),'1');
   assert.equal(await cards.filter({has:page.locator('[data-app-i18n="statsDevAssists"]')}).locator('.fa-dev-stats-empty').textContent(),width===390?'Nessun giocatore':'No players');
   assert.equal(await goals.locator('li .fa-dev-stats-team-name[href="/players/2"]').count(),1);
   assert.equal(await goals.locator('span.fa-dev-stats-club-link').first().textContent(),'QA Club 1');
   const before=await goals.boundingBox();
   const filledSizes=await cards.evaluateAll(nodes=>nodes.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
   assert.ok(filledSizes.every(size=>size.height===filledSizes[0].height),'all eight populated cards reserve equal height');
   const expand=goals.locator('.fa-dev-stats-expand');await expand.click();
   const dialog=page.locator('dialog[open]');
   assert.equal(await dialog.locator('li').count(),8);
   assert.equal(await dialog.locator('.fa-dev-stats-team-name[href="/players/1"]').textContent(),'#1');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   for(const mode of ['mixed','fallback','no-games','archive']){
    await page.evaluate(mode=>window.__stats643Supply(mode),mode);
    assert.equal(await cards.count(),8);
    if(mode==='mixed'){
     await goals.locator('.fa-dev-stats-expand').click();
     assert.equal(await page.locator('dialog[open] li').count(),8);
     await page.keyboard.press('Escape');
    }else if(mode==='fallback'||mode==='no-games'){
     assert.equal(await cards.locator('li').count(),0);
     assert.equal(await goals.locator('.fa-dev-stats-empty').textContent(),width===390?'Nessun giocatore':'No players');
     const emptySizes=await cards.evaluateAll(nodes=>nodes.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
     assert.deepEqual(emptySizes,filledSizes,'every card must keep exactly the same dimensions without players');
     assert.equal((await goals.boundingBox()).height,before.height,'empty leaderboard keeps its populated height');
    }
    else {
     assert.equal(await cards.locator('.fa-dev-stats-team-name[href="/players/58"]').count(),5);
     const portrait=goals.locator('.fa-dev-stats-player-portrait');
     await portrait.locator('img').waitFor({state:'visible'});
     const crop=await portrait.evaluate(el=>({radius:getComputedStyle(el).borderRadius,overflow:getComputedStyle(el).overflow,width:el.clientWidth,height:el.clientHeight,imageWidth:el.querySelector('img').getBoundingClientRect().width,state:el.dataset.portraitState}));
     assert.equal(await portrait.evaluate(el=>el.tagName),'SPAN');
     assert.equal(await goals.locator('li a').count(),1,'the only player-row link is the name');
     assert.equal(crop.radius,'50%');assert.equal(crop.overflow,'hidden');assert.equal(crop.width,crop.height);assert.equal(crop.state,'ready');assert.ok(crop.imageWidth>crop.width*2.7);
     mkdirSync('int24-browser-artifacts',{recursive:true});
     await page.screenshot({path:`int24-browser-artifacts/stats-643-face-${engine}-${id}-${width}.png`,fullPage:true});
    }
   }
   await page.evaluate(()=>window.__stats643Supply('real'));
   const after=await goals.boundingBox();
   assert.deepEqual(after,before,'stable repeated hydration geometry');
   const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(dimensions.scroll<=dimensions.width+2,JSON.stringify(dimensions));
   assert.deepEqual(playerRequests,[],'identity enrichment needs no per-player API');
   assert.deepEqual(errors,[]);
   mkdirSync('int24-browser-artifacts',{recursive:true});
   await page.screenshot({path:`int24-browser-artifacts/stats-643-${engine}-${id}-${width}.png`,fullPage:true});
   // A season change must clear the previous player identities immediately.
   await page.evaluate(()=>{window.faCompetitionContextApi.setDebugSeason(2);window.faCompetitionContextApi.selectSeason(2)});
   assert.equal(await cards.locator('a[href^="/players/"]').count(),0);
   checks++;
  }finally{await context.close()}
 }
 return checks;
}
