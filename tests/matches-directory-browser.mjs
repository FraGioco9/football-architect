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
    {matchId:'25',competitionId:'IT-2',phaseId:'promotionPlayoffs',round:3,tieId:'final',leg:1,homeClubId:null,awayClubId:null,participantA:{kind:'tieWinner',tieId:'semi36'},participantB:{kind:'tieWinner',tieId:'semi45'},result:null,status:'awaiting_participants'},
    {matchId:'21',competitionId:'int-1',phaseId:'quarterfinals',round:1,leg:1,homeClubId:null,awayClubId:null,participantA:{kind:'tieWinner',tieId:'p89'},participantB:{kind:'tieWinner',tieId:'p512'},result:null,status:'awaiting_participants'},
    {matchId:'22',competitionId:'int-1',phaseId:'quarterfinals',round:1,leg:1,homeClubId:null,awayClubId:null,participantA:{kind:'tieWinner',tieId:'p611'},participantB:{kind:'tieWinner',tieId:'p710'},result:null,status:'awaiting_participants'},
    {matchId:'23',competitionId:'int-1',phaseId:'quarterfinals',tieId:'q1',round:1,leg:1,homeClubId:null,awayClubId:null,participantA:{kind:'leagueRank',rank:1},participantB:{kind:'tieWinner',tieId:'p89'},result:null,status:'awaiting_participants'},
    {matchId:'24',competitionId:'int-1',phaseId:'quarterfinals',tieId:'q1',round:1,leg:2,homeClubId:null,awayClubId:null,participantA:{kind:'leagueRank',rank:1},participantB:{kind:'tieWinner',tieId:'p89'},result:null,status:'awaiting_participants'},
    {matchId:'26',competitionId:'int-1',phaseId:'semifinals',tieId:'s1',round:1,leg:1,homeClubId:null,awayClubId:null,participantA:{kind:'tieWinner',tieId:'q1'},participantB:{kind:'tieWinner',tieId:'q2'},result:null,status:'awaiting_participants'},
    {matchId:'27',competitionId:'int-1',phaseId:'semifinals',tieId:'s2',round:1,leg:2,homeClubId:null,awayClubId:null,participantA:{kind:'tieWinner',tieId:'q3'},participantB:{kind:'tieWinner',tieId:'q4'},result:null,status:'awaiting_participants'},
    {matchId:'28',competitionId:'int-1',phaseId:'final',tieId:'final',round:1,leg:1,neutral:true,homeClubId:null,awayClubId:null,participantA:{kind:'tieWinner',tieId:'s1'},participantB:{kind:'tieWinner',tieId:'s2'},result:null,status:'awaiting_participants'}
   ]:[]}});
  });
  await page.goto('http://app.localhost:2000/matches',{waitUntil:'domcontentloaded'});
  const sidebarIconSizes=await page.evaluate(()=>['players','clubs','matches'].map(name=>{
   const icon=document.querySelector('[data-nav01-'+name+'] .fa-icon'),rect=icon?.getBoundingClientRect();
   return [rect?.width,rect?.height];
  }));
  assert.deepEqual(sidebarIconSizes,[[18,18],[18,18],[18,18]],'Matches sidebar icon has the same rendered box as Players and Clubs');
  const match=page.locator('#md-list a.md-score').first();
  assert.equal(await page.locator('#md-season-value').textContent(),'');
  assert.equal(await page.locator('#md-day-value').textContent(),'');
  const widths=[320,375,390,540,541,768,1440],loading=new Map();
  const rowEdges=()=>page.locator('#md-list .md-row').evaluateAll(rows=>rows.map(row=>{
   const {top,bottom}=row.getBoundingClientRect();
   return [top,bottom];
  }));
  const headingBaselineGaps=()=>page.locator('#md-list h2:has(a):has(small)').evaluateAll(headings=>headings.map(heading=>{
   const bottom=node=>{
    const text=node?.firstChild;
    if(!text||text.nodeType!==Node.TEXT_NODE)return null;
    const range=document.createRange();
    range.selectNodeContents(text);
    return [...range.getClientRects()].at(-1)?.bottom??null;
   };
   const name=bottom(heading.querySelector('a'));
   const round=bottom(heading.querySelector('small'));
   return {alignment:getComputedStyle(heading).alignItems,gap:name!==null&&round!==null?name-round:null};
  }));
  const verifyHeadingBaselines=async width=>{
   const measured=await headingBaselineGaps();
   assert(measured.length>0&&measured.every(({alignment,gap})=>alignment==='last baseline'&&
    gap!==null&&Math.abs(gap)<=1.5),'competition and round text bottoms align at '+width+'px: '+JSON.stringify(measured));
  };
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
   await verifyHeadingBaselines(width);
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
  const headingDesktop=['Round 2','Playoffs · Leg 1','Playoffs · Leg 2','Playoffs · Leg 1','Quarter-finals · Leg 1','Quarter-finals · Leg 2','Semi-finals · Leg 1','Semi-finals · Leg 2','Final'];
  const headingMobile=['Round 2','Playoffs','Playoffs','Playoffs','Quarter-finals','Quarter-finals','Semi-finals','Semi-finals','Final'];
  assert.deepEqual(await page.locator('#md-list h2 small').allInnerTexts(),headingDesktop,'two-leg knockout headers retain leg labels but a single-leg final does not');
  await verifyHeadingBaselines(1440);
  const deepLinks=await page.locator('#md-list h2 a').evaluateAll(links=>links.map(a=>{
   const url=new URL(a.href);
   return [url.pathname,url.searchParams.get('season'),url.searchParams.get('matchday')];
  }));
  assert.deepEqual(deepLinks,[
   ['/competitions/it-1/fixtures','1','2'],
   ['/competitions/it-1/fixtures','1','playoffs'],
   ['/competitions/it-1/fixtures','1','playoffs'],
   ['/competitions/it-2/fixtures','1','playoffs'],
   ['/competitions/int-1/fixtures','1','quarterfinals'],
   ['/competitions/int-1/fixtures','1','quarterfinals'],
   ['/competitions/int-1/fixtures','1','semifinals'],
   ['/competitions/int-1/fixtures','1','semifinals'],
   ['/competitions/int-1/fixtures','1','final']
  ],'competition links use the public fixture-picker tokens for every knockout stage');
  const playoffPairs=[[8,9],[5,12],[6,11],[7,10]];
  for(const [higher,lower] of playoffPairs){
   const name='Winner of playoff '+higher+' vs '+lower;
   const slot=page.locator('#md-list .md-team-label[aria-label="'+name+'"]').first();
   assert.equal(await page.locator('#md-list .md-team-label[aria-label="'+name+'"]').count(),higher===8?3:1,'playoff seed ranks are shown for '+higher+' vs '+lower);
   assert.equal(await slot.locator('.md-team-name-full').textContent(),name);
   assert.equal(await slot.locator('.md-team-name-compact').textContent(),'Winner '+higher+'–'+lower);
  }
  for(const [higher,lower] of [[3,6],[4,5]]){
   const fullName='Winner of semifinal '+higher+' vs '+lower;
   const slot=page.locator('#md-list .md-team-label[aria-label="'+fullName+'"]');
   assert.equal(await slot.count(),1,'domestic semifinal pairing appears in final '+higher+' vs '+lower);
   assert.equal(await slot.locator('.md-team-name-full').textContent(),fullName);
   assert.equal(await slot.locator('.md-team-name-compact').textContent(),'Winner '+higher+'–'+lower);
  }
  const internationalRounds=[
   {tie:'q1',name:'Winner of quarter-final 1',compact:'Winner QF 1'},
   {tie:'q2',name:'Winner of quarter-final 2',compact:'Winner QF 2'},
   {tie:'q3',name:'Winner of quarter-final 3',compact:'Winner QF 3'},
   {tie:'q4',name:'Winner of quarter-final 4',compact:'Winner QF 4'},
   {tie:'s1',name:'Winner of semifinal 1',compact:'Winner SF 1'},
   {tie:'s2',name:'Winner of semifinal 2',compact:'Winner SF 2'}
  ];
  for(const {name,compact} of internationalRounds){
   const slot=page.locator('#md-list .md-team-label[aria-label="'+name+'"]');
   assert.equal(await slot.count(),1,'international bracket reference has readable round label: '+name);
   assert.equal(await slot.locator('.md-team-name-full').textContent(),name);
   assert.equal(await slot.locator('.md-team-name-compact').textContent(),compact);
  }
  const fixtureSides=async id=>page.locator('#md-list .md-row:has(a.md-score[href="/matches/'+id+'"])').evaluate(row=>({
   names:[...row.querySelectorAll('.md-team-label')].map(label=>label.getAttribute('aria-label')),
   scoreName:row.querySelector('.md-score').getAttribute('aria-label')
  }));
  assert.deepEqual(await fixtureSides('23'),{names:['Winner of playoff 8 vs 9','Rank 1'],scoreName:'Winner of playoff 8 vs 9 — Rank 1'},'unresolved first leg has lower seed at home');
  assert.deepEqual(await fixtureSides('24'),{names:['Rank 1','Winner of playoff 8 vs 9'],scoreName:'Rank 1 — Winner of playoff 8 vs 9'},'unresolved second leg reverses home and away');
  assert.deepEqual((await fixtureSides('19')).names,['AC Meneghina','US Capitolina'],'resolved first leg retains authoritative clubs');
  assert.deepEqual((await fixtureSides('20')).names,['US Capitolina','AC Meneghina'],'resolved second leg is not flipped twice');
  assert.deepEqual((await fixtureSides('25')).names,['Winner of semifinal 3 vs 6','Winner of semifinal 4 vs 5'],'domestic final preserves bracket participant order');
  assert.deepEqual((await fixtureSides('26')).names,['Winner of quarter-final 2','Winner of quarter-final 1'],'first leg uses expected home-away placeholder order');
  assert.deepEqual((await fixtureSides('27')).names,['Winner of quarter-final 3','Winner of quarter-final 4'],'second leg retains expected home-away placeholder order');
  assert.deepEqual((await fixtureSides('28')).names,['Winner of semifinal 1','Winner of semifinal 2'],'international final has readable semifinal winners');
  const fixtureDetail=async id=>page.locator('#md-list .md-row:has(a.md-score[href="/matches/'+id+'"]) small').innerText();
  assert.equal(await fixtureDetail('28'),'Neutral venue','neutral final does not redundantly show To be confirmed');
  assert.equal(await fixtureDetail('25'),'To be confirmed','unresolved non-neutral final still shows participant status');
  assert(!/playoff (89|512|611|710)\b/i.test(await page.locator('#md-list').innerText()),'never display encoded tie IDs');
  assert(!/\b(?:p512|p611|p710|p89|q[1-4]|s[1-2]|semi36|semi45)\b/i.test(await page.locator('#md-list').innerText()),'all bracket IDs are presentation-only and never shown');
  assert.equal(await page.locator('#md-list [title]').count(),0,'no tooltips on unresolved participants or fixture details');
  const scoreLink=page.locator('#md-list a.md-score').first();
  await scoreLink.focus();
  assert(await scoreLink.evaluate(a=>a===document.activeElement),'match detail remains keyboard-focusable');
  assert.equal(await scoreLink.getAttribute('aria-label'),'AC Meneghina — US Capitolina','score link has both club names for screen readers');
  for(const width of [320,375,390,540]){
   await page.setViewportSize({width,height:800});
   assert.deepEqual(await page.locator('#md-list h2 small').allInnerTexts(),headingMobile,'hide Leg text only on small screens '+width);
   await verifyHeadingBaselines(width);
   assert.equal(await page.locator('#md-list h2 .md-leg:visible').count(),0,'hide every Leg label at '+width);
   for(const [higher,lower] of playoffPairs){
    const slot=page.locator('#md-list .md-team-label[aria-label="Winner of playoff '+higher+' vs '+lower+'"]').first();
    assert(await slot.locator('.md-team-name-compact').isVisible(),'short playoff seed placeholder on mobile '+width);
   }
   for(const [higher,lower] of [[3,6],[4,5]]){
    const slot=page.locator('#md-list .md-team-label[aria-label="Winner of semifinal '+higher+' vs '+lower+'"]');
    assert(await slot.locator('.md-team-name-compact').isVisible(),'domestic semifinal uses compact pairing on mobile '+width);
   }
   for(const {name} of internationalRounds){
    assert(await page.locator('#md-list .md-team-label[aria-label="'+name+'"] .md-team-name-compact').isVisible(),'every international bracket reference uses compact label '+width);
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
  await page.locator('#md-list .md-team-label[aria-label="Vincente playoff 8 vs 9"]').first().waitFor();
  assert.equal(await page.locator('#md-list .md-team-label[aria-label="Vincente playoff 5 vs 12"] .md-team-name-compact').textContent(),'Vincente 5–12','Italian translation preserves seed ranks');
  assert.equal(await page.locator('#md-list .md-team-label[aria-label="Vincente semifinale 3 vs 6"] .md-team-name-compact').textContent(),'Vincente 3–6','Italian domestic semifinal pairing retains seed ranks');
  assert.equal(await page.locator('#md-list .md-team-label[aria-label="Vincente semifinale 4 vs 5"] .md-team-name-full').textContent(),'Vincente semifinale 4 vs 5');
  assert.equal(await page.locator('#md-list .md-team-label[aria-label="Vincente quarto di finale 1"] .md-team-name-compact').textContent(),'Vincente QF 1','Italian quarter-final winner has a compact, readable label');
  assert.equal(await page.locator('#md-list .md-team-label[aria-label="Vincente semifinale 2"] .md-team-name-compact').textContent(),'Vincente SF 2','Italian semifinal winner has a compact, readable label');
  assert.deepEqual((await fixtureSides('24')).names,['Posizione 1','Vincente playoff 8 vs 9'],'Italian second-leg placeholder follows home-away order');
  for(const [lang,quarter,shortQuarter,semi,shortSemi,domestic,shortDomestic] of [
   ['de','Sieger des Viertelfinals 1','Sieger VF 1','Sieger des Halbfinals 2','Sieger HF 2','Sieger des Halbfinals 3 vs 6','Sieger 3–6'],
   ['es','Ganador de cuarto de final 1','Ganador CF 1','Ganador de semifinal 2','Ganador SF 2','Ganador de semifinal 3 vs 6','Ganador 3–6'],
   ['fr','Vainqueur du quart de finale 1','Vainqueur QF 1','Vainqueur de demi-finale 2','Vainqueur DF 2','Vainqueur de demi-finale 3 vs 6','Vainqueur 3–6']
  ]){
   await page.evaluate(lang=>{document.documentElement.lang=lang},lang);
   const quarterSlot=page.locator('#md-list .md-team-label[aria-label="'+quarter+'"]');
   await quarterSlot.waitFor();
   assert.equal(await quarterSlot.locator('.md-team-name-compact').textContent(),shortQuarter,'localized quarter-final abbreviation '+lang);
   const semiSlot=page.locator('#md-list .md-team-label[aria-label="'+semi+'"]');
   assert.equal(await semiSlot.locator('.md-team-name-compact').textContent(),shortSemi,'localized international semifinal abbreviation '+lang);
   const domesticSlot=page.locator('#md-list .md-team-label[aria-label="'+domestic+'"]');
   assert.equal(await domesticSlot.locator('.md-team-name-compact').textContent(),shortDomestic,'localized domestic semifinal abbreviation '+lang);
  }
  await page.evaluate(()=>document.documentElement.lang='en');
  await page.locator('#md-list .md-team-label[aria-label="Winner of playoff 8 vs 9"]').first().waitFor();
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

  // The full 128-match domestic day tests DOM scale, widths, local filtering and Back cache.
  const dense=await context.newPage();
  const scopes=['IT','ENG','ES','DE','FR','PT','NL','BR'].flatMap(c=>[1,2].map(n=>c+'-'+n));
  const denseFixtures=scopes.flatMap((competitionId,i)=>Array.from({length:8},(_,j)=>({
   matchId:String(1000+i*8+j),competitionId,phaseId:'league',round:1,
   homeClubId:'BR-34',awayClubId:'BR-29',venue:'Estádio das Charqueadas',
   result:{homeGoals:2,awayGoals:1},status:'completed'
  })));
  let denseRequests=0;
  await dense.route('**/api/world',route=>route.fulfill({json:{world}}));
  await dense.route('**/api/matches?*',route=>{
   denseRequests++;
   return route.fulfill({json:{schemaVersion:1,providerId:'authoritative-world',world,
    selectedSeason:1,day:13,publication:'published',fixtures:denseFixtures}});
  });
  await dense.goto('http://app.localhost:2000/matches?season=1&day=13',{waitUntil:'domcontentloaded'});
  await dense.waitForFunction(()=>document.querySelectorAll('#md-list .md-row:not(.md-skeleton)').length===128);
  assert.equal(await dense.locator('#md-list section').count(),16,'all sixteen domestic groups render');
  for(const width of [320,390,540,768,1440]){
   await dense.setViewportSize({width,height:800});
   const w=await dense.locator('#md-list').evaluate(n=>[n.scrollWidth,n.clientWidth]);
   assert(w[0]<=w[1]+1,'128 fixtures stay within the page at '+width+'px');
  }
  await dense.locator('.fa-shell-content-scroll').evaluate(n=>{n.scrollTop=n.scrollHeight});
  assert.equal(await dense.locator('#md-list .md-row').last().count(),1,'last fixture survives scrolling');
  await dense.locator('#md-country').click();
  await dense.locator('#md-country-menu [data-menu-value="BR"]').click();
  assert.equal(await dense.locator('#md-list .md-row').count(),16,'country filtering stays local');
  await dense.goBack();
  await dense.waitForFunction(()=>document.querySelectorAll('#md-list .md-row').length===128);
  assert.equal(denseRequests,1,'return to cached day/filter never refetches');

  // Reject a duplicate official ID before rendering a link; retry a valid playout day.
  const corrupt=await context.newPage();
  let retries=0;
  const playout={matchId:'41',competitionId:'IT-1',phaseId:'playout',round:31,leg:1,
   tieId:'playout',homeClubId:null,awayClubId:null,
   participantA:{kind:'leagueRank',rank:13},participantB:{kind:'leagueRank',rank:14},
   result:null,status:'awaiting_participants'};
  await corrupt.route('**/api/world',route=>route.fulfill({json:{world}}));
  await corrupt.route('**/api/matches?*',route=>{
   retries++;
   return route.fulfill({json:{schemaVersion:1,providerId:'authoritative-world',world,
    selectedSeason:1,day:13,publication:'published',
    fixtures:retries===1?[playout,{...playout}]:[playout]}});
  });
  await corrupt.goto('http://app.localhost:2000/matches?season=1&day=13',{waitUntil:'domcontentloaded'});
  await corrupt.getByText('Matches unavailable.').waitFor();
  assert.equal(await corrupt.locator('#md-list a.md-score').count(),0,'corrupt data never renders links');
  await corrupt.getByRole('button',{name:'Retry'}).click();
  await corrupt.locator('#md-list a.md-score').first().waitFor();
  const url=new URL(await corrupt.locator('#md-list h2 a').first().getAttribute('href'),corrupt.url());
  assert.equal(url.searchParams.get('matchday'),'playout','domestic playout deep link');
  assert.equal(retries,2,'retry recovers with one fresh request');
 }finally{await context.close()}
}
