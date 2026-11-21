// #643: isolated presentation fixtures, no remote DB or sporting writes.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {createBrowserTiming} from '../tools/ci-browser-timing.mjs';

export async function verifyCompetitionPlayerStats(browser,{engine='chromium'}={}){
 const timing=createBrowserTiming('competition-player-stats',engine);
 try{
 let checks=0;
 for(const id of ['it-1','int-1','int-2'])for(const width of [390,1440]){
  const scenarioStart=timing.now();
  const contextStart=timing.now();
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],playerRequests=[];
  timing.sample('context-page-ready',timing.now()-contextStart);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/players'))playerRequests.push(request.url())});
  try{
   let phaseStart=timing.now();
   await page.addInitScript(width=>{
    localStorage.setItem('football-architect:language',width===390?'it':'en');
    localStorage.setItem('football-architect:theme',width===390?'light':'dark');
   },width);
   // The public world is explicitly unavailable; fixtures below are supplied
   // only to the presentation API after its asynchronous reader is suspended.
   await page.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.goto('http://app.localhost:2000/competitions/'+id+'/stats?season=1',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.faCompetitionContextApi&&window.faCompetitionContext?.selectedSeason===1&&window.faCompetitionStats);
   timing.sample('public-bootstrap-ready',timing.now()-phaseStart);
   phaseStart=timing.now();
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
   timing.sample('isolated-fixture-ready',timing.now()-phaseStart);
   phaseStart=timing.now();
   const cardSizes=async selector=>page.locator(selector).evaluateAll(nodes=>nodes.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
   await page.locator('#fa-dev-stats [data-stats-view="overview"]').click();
   const overviewFilled=await cardSizes('#fa-dev-stats .fa-dev-stats-card');
   assert.deepEqual(await page.locator('#fa-dev-stats .fa-dev-stats-card strong').allTextContents(),
    ['8','16',width===390?'2,00':'2.00'],'Overview formats its three values in the selected language');
   const overviewShell=await page.evaluate(()=>{
    const live=document.getElementById('fa-dev-stats');
    const shell=document.createElement('div');
    shell.className='app-competition-view-skeleton';
    shell.style.cssText='display:block;position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:'+live.getBoundingClientRect().width+'px';
    shell.innerHTML=window.faCompetitionStats.renderSkeleton('overview');
    live.parentElement.append(shell);
    try{
     const bounds=n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height});
     const slots=host=>[...host.querySelectorAll('.fa-dev-stats-card')].map(card=>{
      const r=card.getBoundingClientRect(),value=card.querySelector('.app-competition-stat-value').getBoundingClientRect();
      return {height:value.height,offset:value.top-r.top};
     });
     return {cards:[...shell.querySelectorAll('.fa-dev-stats-card')].map(bounds),
      skeletonSlots:slots(shell),liveSlots:slots(live)};
    }finally{shell.remove()}
   });
   assert.deepEqual(overviewShell.cards,overviewFilled,'Overview first paint reserves exact populated box dimensions');
   assert.deepEqual(overviewShell.skeletonSlots,overviewShell.liveSlots,'Overview number slots align with the skeletons');
   assert.ok(overviewShell.liveSlots.every(slot=>slot.height===50),'every Overview value has one 50px track');
   await page.evaluate(()=>{document.documentElement.lang='de'});
   await page.waitForFunction(()=>document.querySelector('#fa-dev-stats .fa-dev-stats-card:nth-child(3) strong')?.textContent==='2,00');
   await page.evaluate(lang=>{document.documentElement.lang=lang},width===390?'it':'en');
   await page.waitForFunction(expected=>document.querySelector('#fa-dev-stats .fa-dev-stats-card:nth-child(3) strong')?.textContent===expected,width===390?'2,00':'2.00');
   timing.sample('overview-layout-and-locale',timing.now()-phaseStart);
   phaseStart=timing.now();
   await page.locator('#fa-dev-stats [data-stats-view="teams"]').click();
   const teamsFilled=await cardSizes('#fa-dev-stats .fa-dev-stats-team-card');
   await page.locator('#fa-dev-stats [data-stats-view="players"]').click();
   const cards=page.locator('#fa-dev-stats .fa-dev-stats-leader-card');
   const goals=cards.filter({has:page.locator('[data-app-i18n="statsDevGoals"]')});
   assert.equal(await cards.count(),8);
   assert.deepEqual(await cards.locator('h4').evaluateAll(nodes=>nodes.map(n=>n.dataset.appI18n)),['statsDevAverageRating','statsDevMvpAwards','statsDevGoals','statsDevAssists','statsDevGoalsAssists90','statsDevCleanSheets','statsDevStartsSubstitutes','statsDevMinutes']);
   assert.equal(await goals.locator('li strong').first().textContent(),'2');
   assert.equal(await goals.locator('li strong').nth(1).textContent(),'1');
   assert.equal(await cards.filter({has:page.locator('[data-app-i18n="statsDevAssists"]')}).locator('.fa-dev-stats-empty').textContent(),width===390?'Nessun giocatore':'No players');
   assert.equal(await goals.locator('li .fa-dev-stats-team-name[href="/players/2"]').count(),1);
   assert.equal(await goals.locator('a.fa-dev-stats-club-link[href="/clubs/it/1/overview"]').first().textContent(),'QA Club 1');
   const before=await goals.boundingBox();
   const filledSizes=await cards.evaluateAll(nodes=>nodes.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
   assert.ok(filledSizes.every(size=>size.height===filledSizes[0].height),'all nine player cards reserve equal height');

   // Off-screen first-paint oracle: all pending player cards/rows must occupy
   // the same slots as the hydrated presentation at this viewport.
   const loadingGeometry=await page.evaluate(()=>{
    const live=document.getElementById('fa-dev-stats');
    const shell=document.createElement('div');
    shell.className='app-competition-view-skeleton';
    shell.style.cssText='display:block;position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:'+live.getBoundingClientRect().width+'px';
    shell.innerHTML=window.faCompetitionStats.renderSkeleton('players');
    live.parentElement.append(shell);
    try{
     const pending=[...shell.querySelectorAll('.fa-dev-stats-leader-card')];
     const actual=[...live.querySelectorAll('.fa-dev-stats-leader-card')];
     const rows=[...shell.querySelectorAll('.fa-dev-stats-top li')];
     const bounds=node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height});
     const sample=rows[0];
     const portrait=sample.querySelector('.app-view-skeleton-crest-slot');
     const bars=[...sample.querySelectorAll('.fa-dev-stats-player-label .app-skeleton-bar')];
     return {cards:pending.map(bounds),liveCards:actual.map(bounds),
      rows:rows.every(row=>Math.abs(bounds(row).height-bounds(sample).height)<.1),
      rowHeight:bounds(sample).height,portrait:bounds(portrait),
      nameWidth:bounds(bars[0]).width,clubWidth:bounds(bars[1]).width,
      clubWidths:rows.map(row=>bounds(row.querySelector('.fa-dev-stats-club-link>.app-skeleton-bar')).width),
      teamClubWidths:(()=>{
       const teamShell=document.createElement('div');
       teamShell.className='app-competition-view-skeleton';
       teamShell.style.cssText=shell.style.cssText;
       teamShell.innerHTML=window.faCompetitionStats.renderSkeleton('teams');
       live.parentElement.append(teamShell);
       try{return [...teamShell.querySelectorAll('.fa-dev-stats-team-card .fa-dev-stats-team-name>.app-skeleton-bar')].map(node=>bounds(node).width)}
       finally{teamShell.remove()}
      })(),
      valueWidths:pending.map(card=>bounds(card.querySelector('li>strong>.app-skeleton-bar')).width),
      noTooltip:!live.querySelector('.fa-dev-stats-player-label [title]')};
    }finally{shell.remove()}
   });
   assert.deepEqual(loadingGeometry.cards,filledSizes,'first-paint player cards must match their hydrated dimensions');
   assert.equal(loadingGeometry.rows,true,'all 40 pending player rows have the same height');
   assert.equal(loadingGeometry.rowHeight,width===390?52:60);
   assert.equal(loadingGeometry.portrait.width,width===390?40:48);
   assert.equal(loadingGeometry.portrait.height,loadingGeometry.portrait.width);
   assert.ok(loadingGeometry.nameWidth>loadingGeometry.clubWidth*0.7&&loadingGeometry.clubWidth>0,'name and club bars are text-sized');
   assert.equal(loadingGeometry.clubWidths.length,40);
   const clubPattern=loadingGeometry.clubWidths.slice(0,5);
   assert.equal(new Set(clubPattern.map(Math.round)).size,5,'club placeholders have realistic, distinct lengths within a card');
   for(let card=0;card<8;card++)for(let rank=0;rank<5;rank++)
    assert.ok(Math.abs(loadingGeometry.clubWidths[card*5+rank]-clubPattern[rank])<.1,'club widths repeat deterministically at the same rank in every player card');
   assert.equal(loadingGeometry.teamClubWidths.length,35,'seven Teams cards reserve five club names each');
   const teamClubPattern=loadingGeometry.teamClubWidths.slice(0,5);
   assert.equal(new Set(teamClubPattern.map(Math.round)).size,5,'Teams club bars vary by rank too');
   for(let card=0;card<7;card++)for(let rank=0;rank<5;rank++)
    assert.ok(Math.abs(loadingGeometry.teamClubWidths[card*5+rank]-teamClubPattern[rank])<.1,'Teams skeleton repeats its club-width pattern at each rank');
   assert.ok(loadingGeometry.valueWidths[0]>loadingGeometry.valueWidths[2]*1.5,'Rating includes coverage, unlike Goals');
   assert.ok(loadingGeometry.valueWidths[5]>loadingGeometry.valueWidths[2]*1.3,'Clean sheets include appearances');
   assert.equal(loadingGeometry.noTooltip,true,'no native hover tooltip on player names or clubs');
   timing.sample('team-player-skeleton-and-leaders',timing.now()-phaseStart);
   phaseStart=timing.now();
   const expand=goals.locator('.fa-dev-stats-expand');await expand.click();
   const dialog=page.locator('dialog[open]');
   assert.equal(await dialog.locator('li').count(),8);
   assert.equal(await dialog.locator('.fa-dev-stats-team-name[href="/players/1"]').textContent(),'#1');
   assert.equal(await dialog.locator('a.fa-dev-stats-club-link[href="/clubs/it/1/overview"]').count(),8,'Show all links each player to their recorded club');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   timing.sample('expand-dialog-and-keyboard-close',timing.now()-phaseStart);
   phaseStart=timing.now();
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
     if(mode==='no-games'){
      await page.locator('#fa-dev-stats [data-stats-view="overview"]').click();
      assert.deepEqual(await cardSizes('#fa-dev-stats .fa-dev-stats-card'),overviewFilled,'Overview box dimensions must match with and without data');
      await page.locator('#fa-dev-stats [data-stats-view="teams"]').click();
      assert.deepEqual(await cardSizes('#fa-dev-stats .fa-dev-stats-team-card'),teamsFilled,'Teams box dimensions must match with and without data');
      await page.locator('#fa-dev-stats [data-stats-view="players"]').click();
     }
    }
    else {
     assert.equal(await cards.locator('.fa-dev-stats-team-name[href="/players/58"]').count(),5);
     const portrait=goals.locator('.fa-dev-stats-player-portrait');
     await portrait.locator('img').waitFor({state:'visible'});
     const crop=await portrait.evaluate(el=>({radius:getComputedStyle(el).borderRadius,overflow:getComputedStyle(el).overflow,width:el.clientWidth,height:el.clientHeight,imageWidth:el.querySelector('img').getBoundingClientRect().width,state:el.dataset.portraitState}));
     assert.equal(await portrait.evaluate(el=>el.tagName),'SPAN');
     assert.equal(await goals.locator('li a').count(),2,'player name and club name have independent links');
     assert.equal(await goals.locator('li a.fa-dev-stats-club-link[href="/clubs/it/1/overview"]').count(),1);
     assert.equal(crop.radius,'50%');assert.equal(crop.overflow,'hidden');assert.equal(crop.width,crop.height);assert.equal(crop.state,'ready');assert.ok(crop.imageWidth>crop.width*2.7);
     mkdirSync('int24-browser-artifacts',{recursive:true});
     await page.screenshot({path:`int24-browser-artifacts/stats-643-face-${engine}-${id}-${width}.png`,fullPage:true});
    }
   }
   timing.sample('fixture-modes-and-portrait-screenshot',timing.now()-phaseStart);
   phaseStart=timing.now();
   await page.evaluate(()=>window.__stats643Supply('real'));
   const after=await goals.boundingBox();
   assert.deepEqual({width:after.width,height:after.height},{width:before.width,height:before.height},'stable repeated hydration dimensions independent of scroll position');
   const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(dimensions.scroll<=dimensions.width+2,JSON.stringify(dimensions));
   assert.deepEqual(playerRequests,[],'identity enrichment needs no per-player API');
   assert.deepEqual(errors,[]);
   mkdirSync('int24-browser-artifacts',{recursive:true});
   await page.screenshot({path:`int24-browser-artifacts/stats-643-${engine}-${id}-${width}.png`,fullPage:true});
   // A season change must clear the previous player identities immediately.
   await page.evaluate(()=>{window.faCompetitionContextApi.setDebugSeason(2);window.faCompetitionContextApi.selectSeason(2)});
   assert.equal(await cards.locator('a[href^="/players/"]').count(),0);
   timing.sample('restore-screenshot-and-season-invalidation',timing.now()-phaseStart);
   checks++;
  }finally{
   const closeStart=timing.now();
   try{await context.close()}finally{
    timing.sample('context-close',timing.now()-closeStart);
    timing.sample('scenario-total',timing.now()-scenarioStart);
   }
  }
 }
 return checks;
 }finally{timing.mark('suite-complete');timing.report();}
}
