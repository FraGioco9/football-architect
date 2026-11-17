// Regression: Season 0 must not publish unconfirmed identities or standings.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const playwright=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const engine=process.env.FA_AUTH_BROWSER||'chromium';
const browser=await playwright[engine].launch({headless:true,...(process.env.FA_ACCOUNT_CHROME&&engine!=='webkit'?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
const server=createPreviewServer();let checks=0;
try{
 server.listen(2000,'127.0.0.1');await once(server,'listening');
 for(const width of [1440,390])for(const id of ['it-1','eng-2','int-1','int-2']){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   await context.addInitScript(()=>sessionStorage.setItem('football-architect:standings-dev-season','0'));
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:2000/competitions/'+id+'/standings');
   await page.waitForFunction(()=>window.faCompetitionRoute&&window.faFixtures&&document.documentElement.dataset.faDevStandingsPending===undefined);
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.faDevCurrentSeason),'0');
   assert.equal(await page.evaluate(()=>window.faCompetitionContext.seasonData),null,'Season 0 cannot fabricate season results');
   assert.equal(await page.locator('#app-standings-body [data-world-club],#app-standings-compact-list [data-world-club]').count(),0,
    'Unconfirmed Season 0 entrants must not be rendered for any competition');
   assert.equal(await page.locator('#app-standings-body .app-competition-empty-row').count(),1);
   assert.equal(await page.locator('#app-standings-compact-list .app-world-mobile-empty').count(),1);
   assert.equal(await page.locator('#app-standings-body a.app-world-club-name,#app-standings-compact-list a.app-world-mobile-club-name').count(),0);
   assert.equal(await page.locator('#app-standings-body .app-competition-empty-row').textContent(),'No standings available yet.');
   const emptyLayout=await page.evaluate(()=>{
    const row=document.querySelector('#app-standings-body tr.app-standings-empty-row');
    const cell=row?.querySelector('td.app-competition-empty-row');
    const card=document.querySelector('#app-standings-compact-list .app-world-mobile-empty');
    const note=card?.querySelector('.app-competition-status');
    const centerGap=note&&card?Math.abs((note.getBoundingClientRect().top+note.getBoundingClientRect().bottom)/2-
      (card.getBoundingClientRect().top+card.getBoundingClientRect().bottom)/2):null;
    return {rowHeight:row?.getBoundingClientRect().height,cellAlign:cell?getComputedStyle(cell).verticalAlign:null,
      cardHeight:card?.getBoundingClientRect().height,centerGap};
   });
   assert.equal(emptyLayout.cellAlign,'middle','empty desktop cell uses vertical middle alignment');
   if(width>620){
    assert.ok(emptyLayout.rowHeight>=240,'visible desktop table centers its empty message');
   }else{
    assert.ok(emptyLayout.cardHeight>=240,'visible mobile card preserves the empty-message region');
    assert.ok(emptyLayout.centerGap<=2,'visible mobile message is vertically centered');
   }
   checks++;
  }finally{await context.close();}
 }
 // A confirmed entrant snapshot has club identities but *no* sporting rank,
 // points, form or outcome bands. Simulate this strictly inside an enabled
 // DEV session; no public authority or Admin receipt is fabricated.
 for(const width of [1440,390])for(const id of ['it-1','int-1']){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   await context.addInitScript(()=>{
    sessionStorage.setItem('football-architect:debug-enabled','on');
    sessionStorage.setItem('football-architect:standings-dev-season','1');
    sessionStorage.setItem('football-architect:standings-dev-matchdays','0');
   });
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:2000/competitions/'+id+'/standings');
   await page.waitForFunction(()=>window.faDebugEnabled===true&&!!window.faCompetitionContextApi&&
    !!window.faStandingsMobile&&document.documentElement.dataset.faDevStandingsPending===undefined);
   const accepted=await page.evaluate(async()=>{
    const c=window.faCompetitionContext,manifest=await window.faCompetitionManifestPromise;
    const division=manifest.divisions.find(d=>d.id===c.definition.id);
    const participants=division?division.clubs:manifest.divisions.filter(d=>d.tier===1).flatMap(d=>d.clubs.slice(0,3));
    const standings=participants.map(club=>({club,played:0,won:0,drawn:0,lost:0,
     gf:0,ga:0,gd:0,pts:0,recent:[]}));
    return window.faCompetitionContextApi.replaceSeasonData({
     season:c.selectedSeason,rulesVersion:c.definition.rules.version,participants,
     fixtures:null,results:[],statistics:{standings},status:'partial',entrantsOnly:true
    },c.revision);
   });
   assert.equal(accepted,true,'DEV-only confirmed entrant fixture accepted');
   const before=await page.evaluate(()=>{
    const desktop=[...document.querySelectorAll('#app-standings-body tr[data-world-club]')];
    const mobile=[...document.querySelectorAll('#app-standings-compact-list li[data-world-club]')];
    const first=desktop[0],legend=document.querySelector('.app-standings-legend');
    return {desktop:desktop.length,mobile:mobile.length,names:desktop.map(row=>row.children[1].textContent.trim()),
     dashedCells:desktop.every(row=>[...row.querySelectorAll('td')].every(cell=>cell.textContent.trim()==='—')),
     mobileDashes:mobile.every(item=>item.querySelector('.app-world-mobile-position')?.textContent==='—'&&
      item.querySelector('.app-world-mobile-points')?.firstChild?.textContent==='—'&&
      [...item.querySelectorAll('.app-world-mobile-stat dd')].every(cell=>cell.textContent==='—')),
     bands:document.querySelectorAll('#app-standings-body [data-standing-rank],#app-standings-compact-list [data-standing-outcome]').length,
     badges:document.querySelectorAll('#app-standings-compact-list .app-world-mobile-points').length,
     disclosures:document.querySelectorAll('#app-standings-compact-list details').length,
     recent:document.querySelectorAll('#app-standings-compact-list .app-world-mobile-form').length,
     legendVisible:legend?!legend.hidden:false,
     firstKey:first?.dataset.worldClub};
   });
   const expected=id==='it-1'?16:24;
   assert.equal(before.desktop,expected);
   assert.equal(before.mobile,expected);
   assert.ok(before.dashedCells,'every desktop unplayed sporting cell shows a dash');
   assert.ok(before.mobileDashes,'mobile ranks, points and expanded statistics show dashes');
   assert.equal(before.bands,0,'no position highlights before kickoff');
   assert.equal(before.badges,expected,'mobile points keep reserved slots showing a dash');
   assert.equal(before.disclosures,expected,'unplayed statistics remain accessible as dash placeholders');
   assert.equal(before.recent,expected,'recent form shows the unknown marker');
   assert.equal(before.legendVisible,false);
   assert.deepEqual(before.names,[...before.names].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'})));
   const resumed=await page.evaluate(()=>{
    const c=window.faCompetitionContext;
    return window.faCompetitionContextApi.replaceSeasonData({...c.seasonData,
     statistics:{...c.seasonData.statistics,standings:c.seasonData.statistics.standings.map(row=>
      ({...row,played:1,drawn:1,pts:1}))}
    },c.revision);
   });
   assert.equal(resumed,true);
   const after=await page.evaluate(()=>({
    ranks:document.querySelectorAll('#app-standings-body [data-standing-rank]').length,
    numeric:document.querySelector('#app-standings-body tr[data-world-club] td:nth-child(10)')?.textContent,
    details:document.querySelectorAll('#app-standings-compact-list details').length,
    points:document.querySelectorAll('#app-standings-compact-list .app-world-mobile-points').length
   }));
   assert.equal(after.ranks,expected,'after the first match the rank is visible');
   assert.equal(after.numeric,'1','points are visible after kickoff');
   assert.equal(after.details,expected,'sporting detail is restored after kickoff');
   assert.equal(after.points,expected);
   checks++;
  }finally{await context.close();}
 }

 console.log('Season 0 unconfirmed entrants browser PASS: '+checks+' cases ('+engine+')');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await browser.close();}
