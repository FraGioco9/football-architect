import assert from 'node:assert/strict';

export async function verifyMatchesDirectory(browser){
 const context=await browser.newContext({locale:'en'});
 try{
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:15,seasonNumber:1,day:13,phase:'active'};
  let requests=0;
  let releaseLogo;
  const pendingLogo=new Promise(resolve=>{releaseLogo=resolve});
  await page.route('**/assets/divisions/**/*.svg',async route=>{await pendingLogo;await route.abort()});
  await page.route('**/assets/clubs/**/*.svg',route=>route.abort());
  let releaseWorld;
  const initialWorld=new Promise(resolve=>{releaseWorld=resolve});
  await page.route('**/api/world',async route=>{await initialWorld;await route.fulfill({json:{world}})});
  await page.route('**/api/matches?*',route=>{
   const day=Number(new URL(route.request().url()).searchParams.get('day'));requests++;
   return route.fulfill({json:{schemaVersion:1,providerId:'authoritative-world',world,selectedSeason:1,day,publication:'published',fixtures:day===13?Array.from({length:8},(_,i)=>(
    {matchId:String(17+i),competitionId:'BR-2',phaseId:'league',round:1,homeClubId:'BR-34',awayClubId:'BR-29',venue:'Estádio das Charqueadas',result:{homeGoals:2,awayGoals:1},status:'completed'}
   )):day===15?[
    {matchId:'18',competitionId:'IT-1',phaseId:'league',round:2,homeClubId:'IT-1',awayClubId:'IT-2',result:null,status:'scheduled'},
    {matchId:'19',competitionId:'IT-1',phaseId:'promotionPlayoffs',round:2,leg:1,homeClubId:'IT-1',awayClubId:'IT-2',result:null,status:'scheduled'},
    {matchId:'20',competitionId:'IT-1',phaseId:'promotionPlayoffs',round:2,leg:2,homeClubId:'IT-2',awayClubId:'IT-1',result:null,status:'scheduled'},
    {matchId:'21',competitionId:'int-1',phaseId:'quarterfinals',round:1,leg:1,homeClubId:null,awayClubId:null,participantA:{kind:'tieWinner',tieId:'p89'},participantB:{kind:'tieWinner',tieId:'p512'},result:null,status:'awaiting_participants'},
    {matchId:'22',competitionId:'int-1',phaseId:'quarterfinals',round:1,leg:1,homeClubId:null,awayClubId:null,participantA:{kind:'tieWinner',tieId:'p611'},participantB:{kind:'tieWinner',tieId:'p710'},result:null,status:'awaiting_participants'},
    {matchId:'23',competitionId:'int-1',phaseId:'quarterfinals',tieId:'q1',round:1,leg:1,homeClubId:null,awayClubId:null,participantA:{kind:'leagueRank',rank:1},participantB:{kind:'tieWinner',tieId:'p89'},result:null,status:'awaiting_participants'},
    {matchId:'24',competitionId:'int-1',phaseId:'quarterfinals',tieId:'q1',round:1,leg:2,homeClubId:null,awayClubId:null,participantA:{kind:'leagueRank',rank:1},participantB:{kind:'tieWinner',tieId:'p89'},result:null,status:'awaiting_participants'}
   ]:[]}});
  });
  await page.goto('http://app.localhost:2000/matches',{waitUntil:'domcontentloaded'});
  const match=page.locator('#md-list a.md-score').first();
  assert.equal(await page.locator('#md-season-value').textContent(),'');
  assert.equal(await page.locator('#md-day-value').textContent(),'');
  const widths=[320,375,390,540,541,768,1440],loading=new Map();
  const rowEdges=()=>page.locator('#md-list .md-row').evaluateAll(rows=>rows.map(row=>{
   const {top,bottom}=row.getBoundingClientRect();
   return [top,bottom];
  }));
  for(const width of widths){
   await page.setViewportSize({width,height:800});
   const name=await page.locator('#md-list .md-name-bar').boundingBox();
   assert(name.width>0);
   loading.set(width,{nameX:name.x,edges:await rowEdges()});
   if(width<=540){
    const skeleton=await page.locator('#md-list .md-row.md-skeleton').first().evaluate(row=>{
     const bars=[...row.querySelectorAll('.md-team-bar')];
     return {lines:getComputedStyle(row).getPropertyValue('--md-team-lines').trim(),
      count:bars.length,heights:bars.map(bar=>bar.getBoundingClientRect().height),
      backgrounds:bars.map(bar=>getComputedStyle(bar).backgroundImage)};
    });
    assert.equal(skeleton.lines,'1','mobile club name reserves one line '+width);
    assert.equal(skeleton.count,2,'one name skeleton per club '+width);
    assert(skeleton.heights.every(height=>height>0&&height<16),'mobile club skeletons stay single-height '+width);
    assert(skeleton.backgrounds.every(background=>background==='none'),'mobile club skeletons do not render repeated bars '+width);
   }
  }
  releaseWorld();
  await match.waitFor();
  assert.equal(new URL(await match.getAttribute('href'),page.url()).pathname,'/matches/17');
  assert.equal(await page.locator('#md-list h2 a .md-logo').count(),0);
  assert(await page.locator('#md-current').isDisabled());
  assert.equal(await page.locator('#md-list h2 > .md-logo').textContent(),'');
  assert.equal(await page.locator('#md-list h2 > .app-competition-logo-placeholder').count(),0);
  releaseLogo();
  await page.locator('#md-list h2 > .app-competition-logo-placeholder').waitFor();
  assert.equal(await page.locator('#md-list h2 small').innerText(),'Round 1');
  assert.equal(await page.locator('.md-row').getByText('Round 1').count(),0);
  assert.equal(await page.locator('.md-row .md-team:first-child > a + .md-logo').count(),8);
  assert.equal(await page.locator('.md-row .md-team:last-of-type > .md-logo + a').count(),8);
  assert.equal(await page.locator('#md-list img').count(),0,'failed images keep the placeholders');
  assert.equal(await page.locator('#md-list [title]').count(),0,'club and fixture tooltips are removed');
  await match.hover();
  assert.equal(await match.evaluate(a=>getComputedStyle(a).textDecorationLine),'none');
  await page.evaluate(()=>document.querySelector('.fa-shell-content-scroll').dispatchEvent(new Event('scroll')));
  assert.equal(await page.locator('.matches-directory[data-scrolling]').count(),1);
  await page.mouse.move(1,1);
  await page.waitForFunction(()=>!document.querySelector('.matches-directory[data-scrolling]'));
  const divisionLogo=await page.locator('#md-list h2 > .md-logo').elementHandle();
  for(const width of widths){
   await page.setViewportSize({width,height:800});
   assert.deepEqual(await rowEdges(),loading.get(width).edges,'row boundaries at '+width+'px');
   assert.equal((await page.locator('#md-list h2 a').boundingBox()).x,loading.get(width).nameX);
   const searchBox=await page.locator('#md-q').boundingBox(),filterBox=await page.locator('#md-country').boundingBox();
   const [prev,day,next]=await Promise.all(['prev','day','next'].map(id=>page.locator('#md-'+id).boundingBox()));
   for(const arrow of [prev,next]){
    assert.equal(arrow.width,day.height);
    assert.equal(arrow.height,day.height);
    assert.equal(arrow.y,day.y);
   }
   for(const id of ['prev','next']){
    const button=page.locator('#md-'+id),box=await button.boundingBox(),icon=await button.locator('path').boundingBox();
    assert(Math.abs(box.x+box.width/2-icon.x-icon.width/2)<1);
    assert(Math.abs(box.y+box.height/2-icon.y-icon.height/2)<1);
   }
   assert(prev.x+prev.width<=day.x&&day.x+day.width<=next.x);
   assert.equal(searchBox.height,filterBox.height,'search and filter heights match');
   if(width<=540){
    const controls=await page.locator('.md-controls:not(.md-filters)').boundingBox();
    const season=await page.locator('#md-season').boundingBox();
    const current=await page.locator('#md-current').boundingBox();
    const heading=await page.locator('#md-list h2').first().boundingBox();
    const firstRow=await page.locator('#md-list .md-row').first().boundingBox();
    const rowFont=await page.locator('#md-list .md-row').first().evaluate(row=>parseFloat(getComputedStyle(row).fontSize));
    assert(Math.abs(season.x-controls.x)<2,'season starts at content edge '+width);
    assert(Math.abs(next.x+next.width-(controls.x+controls.width))<2,'day navigation fills the remaining width '+width);
    assert(current.width<controls.width,'current day stays content-sized on mobile '+width);
    assert(Math.abs(current.x+current.width/2-controls.x-controls.width/2)<2,'current day button stays centered '+width);
    assert.equal(await page.locator('#md-current').evaluate(button=>getComputedStyle(button).textAlign),'center');
    assert(heading.y-searchBox.y-searchBox.height<20,'no empty status gap after search '+width);
    assert(firstRow.height<70,'mobile fixture row stays compact '+width);
    const horizontalPadding=await page.locator('#md-list .md-row').first().evaluate(row=>{const style=getComputedStyle(row);return [parseFloat(style.paddingLeft),parseFloat(style.paddingRight)]});
    assert.deepEqual(horizontalPadding,[0,0],'mobile fixture row has no side padding '+width);
    assert(rowFont<14,'mobile fixture typography stays compact '+width);
    const logoScoreGaps=await page.locator('.md-row:not(.md-skeleton)').first().evaluate(row=>{
     const score=row.querySelector('.md-score'),range=document.createRange();
     range.selectNodeContents(score);
     const text=range.getBoundingClientRect();
     const logos=row.querySelectorAll('.md-team > .md-logo');
     return [text.left-logos[0].getBoundingClientRect().right,logos[1].getBoundingClientRect().left-text.right];
    });
    assert(logoScoreGaps.every(gap=>gap>=-1&&gap<20),'both mobile crests stay close to the actual score text '+width);
    const team=page.locator('.md-row .md-team-label').first();
    assert.equal(await team.getAttribute('aria-label'),'Esportivo das Charqueadas','full club name remains accessible '+width);
    assert.equal(await team.locator('.md-team-name-compact').textContent(),'Charqueadas','use canonical compact club name '+width);
    assert(await team.locator('.md-team-name-compact').isVisible(),'compact club name shown on small screens '+width);
    assert(!await team.locator('.md-team-name-full').isVisible(),'full club name hidden visually on small screens '+width);
   }else if(width===1440){
    const team=page.locator('.md-row .md-team-label').first();
    assert(await team.locator('.md-team-name-full').isVisible(),'desktop retains full club name');
    assert(!await team.locator('.md-team-name-compact').isVisible(),'desktop hides compact club name');
   }
   assert(await page.locator('.matches-directory').evaluate(n=>n.clientWidth>0&&n.scrollWidth<=n.clientWidth+1),'directory overflow '+width);
  }
  for(const key of ['season','day','country','competition','search']){
   const caption=page.locator('.md-field > [data-word="'+key+'"]');
   await caption.hover();
   assert.equal(await page.locator('.md-controls :is(button,input):hover').count(),0);
   await caption.click();
   assert.equal(await page.locator('.md-controls :is(input:focus,button:focus,[aria-expanded="true"])').count(),0);
  }
  await page.getByRole('searchbox',{name:'Search team'}).click();
  assert(await page.locator('#md-q').evaluate(input=>input===document.activeElement));
  const searchBefore=await page.locator('#md-q').boundingBox();
  await page.locator('#md-country').click();
  await page.locator('#md-country-menu [data-menu-value="ENG"]').click();
  assert.deepEqual(await page.locator('#md-q').boundingBox(),searchBefore);
  assert.equal(await match.count(),0);
  await page.goBack();await match.waitFor();
  assert(await divisionLogo.evaluate(slot=>slot===document.querySelector('#md-list h2 > .md-logo')),'reuse the resolved logo on return');
  assert.equal(requests,1,'filter and Back reuse the same day');
  await page.locator('#md-next').click();
  await page.getByText('No matches on this day.').waitFor();
  assert(await page.locator('#md-current').isEnabled());
  await page.locator('#md-next').click();await match.waitFor();
  const headingDesktop=['Round 2','Playoffs · Leg 1','Playoffs · Leg 2','Quarter-finals · Leg 1','Quarter-finals · Leg 2'];
  const headingMobile=['Round 2','Playoffs','Playoffs','Quarter-finals','Quarter-finals'];
  assert.deepEqual(await page.locator('#md-list h2 small').allInnerTexts(),headingDesktop,'each knockout leg appears beside its phase heading on desktop');
  const playoffPairs=[[8,9],[5,12],[6,11],[7,10]];
  for(const [higher,lower] of playoffPairs){
   const name='Winner of playoff '+higher+' vs '+lower;
   const slot=page.locator('#md-list .md-team-label[aria-label="'+name+'"]').first();
   assert.equal(await page.locator('#md-list .md-team-label[aria-label="'+name+'"]').count(),higher===8?3:1,'playoff seed ranks are shown for '+higher+' vs '+lower);
   assert.equal(await slot.locator('.md-team-name-full').textContent(),name);
   assert.equal(await slot.locator('.md-team-name-compact').textContent(),'Winner '+higher+'–'+lower);
  }
  const fixtureSides=async id=>page.locator('#md-list .md-row:has(a.md-score[href="/matches/'+id+'"])').evaluate(row=>({
   names:[...row.querySelectorAll('.md-team-label')].map(label=>label.getAttribute('aria-label')),
   scoreName:row.querySelector('.md-score').getAttribute('aria-label')
  }));
  assert.deepEqual(await fixtureSides('23'),{names:['Winner of playoff 8 vs 9','Rank 1'],scoreName:'Winner of playoff 8 vs 9 — Rank 1'},'unresolved first leg has lower seed at home');
  assert.deepEqual(await fixtureSides('24'),{names:['Rank 1','Winner of playoff 8 vs 9'],scoreName:'Rank 1 — Winner of playoff 8 vs 9'},'unresolved second leg reverses home and away');
  assert.deepEqual((await fixtureSides('19')).names,['AC Meneghina','US Capitolina'],'resolved first leg retains authoritative clubs');
  assert.deepEqual((await fixtureSides('20')).names,['US Capitolina','AC Meneghina'],'resolved second leg is not flipped twice');
  assert(!/playoff (89|512|611|710)\b/i.test(await page.locator('#md-list').innerText()),'never display encoded tie IDs');
  assert.equal(await page.locator('#md-list [title]').count(),0,'no tooltips on unresolved participants or fixture details');
  for(const width of [320,375,390,540]){
   await page.setViewportSize({width,height:800});
   assert.deepEqual(await page.locator('#md-list h2 small').allInnerTexts(),headingMobile,'hide Leg text only on small screens '+width);
   assert.equal(await page.locator('#md-list h2 .md-leg:visible').count(),0,'hide every Leg label at '+width);
   for(const [higher,lower] of playoffPairs){
    const slot=page.locator('#md-list .md-team-label[aria-label="Winner of playoff '+higher+' vs '+lower+'"]').first();
    assert(await slot.locator('.md-team-name-compact').isVisible(),'short playoff seed placeholder on mobile '+width);
   }
   assert.deepEqual((await fixtureSides('24')).names,['Rank 1','Winner of playoff 8 vs 9'],'second-leg ordering remains correct on mobile '+width);
  }
  await page.setViewportSize({width:1440,height:800});
  assert.deepEqual(await page.locator('#md-list h2 small').allInnerTexts(),headingDesktop,'restore Leg labels on desktop');
  for(const [higher,lower] of playoffPairs){
   const slot=page.locator('#md-list .md-team-label[aria-label="Winner of playoff '+higher+' vs '+lower+'"]').first();
   assert(await slot.locator('.md-team-name-full').isVisible(),'descriptive seed winner on desktop');
  }
  await page.evaluate(()=>document.documentElement.lang='it');
  await page.locator('#md-list .md-team-label[aria-label="Vincente playoff 8 vs 9"]').waitFor();
  assert.equal(await page.locator('#md-list .md-team-label[aria-label="Vincente playoff 5 vs 12"] .md-team-name-compact').textContent(),'Vincente 5–12','Italian translation preserves seed ranks');
  assert.deepEqual((await fixtureSides('24')).names,['Posizione 1','Vincente playoff 8 vs 9'],'Italian second-leg placeholder follows home-away order');
  await page.evaluate(()=>document.documentElement.lang='en');
  await page.locator('#md-list .md-team-label[aria-label="Winner of playoff 8 vs 9"]').waitFor();
  assert.equal(await page.locator('#md-list .md-row small').filter({hasText:/Leg [12]/}).count(),0,'do not repeat Leg per fixture');
  const href=new URL(await page.locator('#md-list h2 a').first().getAttribute('href'),page.url());
  assert.equal(href.pathname,'/competitions/it-1/fixtures');
  assert.equal(href.searchParams.get('matchday'),'2');
  assert.equal(href.searchParams.get('season'),'1');
  await page.goBack();await page.getByText('No matches on this day.').waitFor();
  await page.goForward();await match.waitFor();
  await page.locator('#md-current').click();await match.waitFor();
  assert.equal(requests,3,'Back, Forward and Current day reuse all visited days, including empty ones');
  world.revision++;
  await page.evaluate(()=>dispatchEvent(new Event('fa:world-invalidated')));
  await match.waitFor();
  assert.equal(requests,4,'refresh after world invalidation');
  await page.locator('#md-q').fill('xxxx');
  await page.getByText('No matching fixtures.').waitFor();
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
