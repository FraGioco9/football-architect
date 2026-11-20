// #577 — Real Chromium / WebKit computed first-paint QA on the shared match shell.
// The HTML response uses the production parser-time renderer with a verified
// synthetic match identity; no real-world match data, remote DB or deploy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {applyPublishedMatchFirstPaint,applyPublishedMatchDocument} from '../tools/match-first-paint.mjs';

const shell=readFileSync(new URL('../matches/_shared/index.html',import.meta.url),'utf8');
const manifestClubs=JSON.parse(readFileSync(new URL('../clubs/_shared/manifest.json',import.meta.url),'utf8')).clubs;
const officialClub=id=>{
 const [countryId,clubId]=id.split('-');return manifestClubs.find(c=>c.countryId===countryId&&c.clubId===Number(clubId));
};
const match={schemaVersion:1,providerId:'authoritative-world',matchId:'123',
 season:1,competitionId:'IT-1',stageId:'league',round:1,day:1,
 provenance:{kind:'authoritative'}};
const decorated=applyPublishedMatchFirstPaint(shell,match,'123');
assert.ok(decorated.includes('data-fa-match-first-paint'));
assert.ok(decorated.indexOf('data-fa-match-first-paint')<decorated.indexOf('</head>'));
assert.ok(!shell.includes('data-fa-match-first-paint'));
const cases=[{width:1440,expectedWidth:254},{width:900,expectedWidth:254},{width:390,expectedWidth:254},{width:320,expectedWidth:204}];
const engines={chromium,webkit};
let count=0;
for(const [engine,driver] of Object.entries(engines)){
 const browser=await driver.launch({headless:true});
 try{
  // Dedicated statistics may include substitutes and can arrive after the score.
  const lineupScenarios=[
   {width:390,kind:'eleven',shown:true},
   {width:1440,kind:'substitutions',shown:true},
   {width:320,kind:'dismissal',shown:true},
   {width:900,kind:'extra-time',shown:true},
   {width:390,kind:'penalties',shown:true},
   {width:390,kind:'ten-starters',shown:false},
   {width:1440,kind:'twelve-starters',shown:false},
   {width:390,kind:'duplicate-id',shown:false},
   {width:1440,kind:'fallback',shown:false},
   {width:390,kind:'receipt-mismatch',shown:false},
   {width:390,kind:'unavailable',shown:false}
  ];
  for(const scenario of lineupScenarios){
   const ctx=await browser.newContext({viewport:{width:scenario.width,height:900}});
   const page=await ctx.newPage();let release;
   const gate=new Promise(resolve=>release=resolve);
   const result=scenario.kind==='penalties'
    ?{homeGoals:1,awayGoals:1,resolution:'penalties',regulation:{home:1,away:1},extraTime:{home:0,away:0},penalties:{home:4,away:3},winnerClubId:'IT-1'}
    :scenario.kind==='extra-time'
    ?{homeGoals:2,awayGoals:1,resolution:'extra-time',regulation:{home:1,away:1},extraTime:{home:1,away:0},penalties:null,winnerClubId:'IT-1'}
    :{homeGoals:2,awayGoals:1,resolution:'regulation',regulation:{home:2,away:1},extraTime:null,penalties:null,winnerClubId:'IT-1'};
   const played={...match,day:13,status:'completed',homeParticipant:{clubId:'IT-1'},awayParticipant:{clubId:'IT-2'},
    result,provenance:{kind:'authoritative',receiptHash:'a'.repeat(64)}};
   const document=applyPublishedMatchDocument(shell,played,'123');
   try{
    await page.route('**/matches/123',route=>route.fulfill({status:200,contentType:'text/html',body:document}));
    await page.route('**/api/competitions/IT-1/seasons/1',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
    await page.route('**/api/matches/123',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(played)}));
    await page.route('**/api/matches/123/stats',async route=>{
     await gate;
     if(scenario.kind==='unavailable')return route.fulfill({status:503,contentType:'application/json',body:'{}'});
     const people=Array.from({length:11},(_,i)=>({playerId:i+1,name:'Frozen Player '+(i+1),nationality:'ITA',role:i===0?'GK':'CM',started:true,minutes:scenario.kind==='dismissal'&&i===2?67:90,goals:0,assists:null,redCards:null,cleanSheets:i===0?0:null,rating:6.5}));
     if(['substitutions','twelve-starters','duplicate-id'].includes(scenario.kind)){
      people.push(...Array.from({length:3},(_,i)=>({playerId:i+12,name:'Substitute '+(i+12),nationality:'ITA',role:'CM',started:false,minutes:22,goals:0,assists:0,redCards:0,cleanSheets:null,rating:6.1})));
     }
     if(scenario.kind==='ten-starters')people[10].started=false;
     if(scenario.kind==='twelve-starters')people[11].started=true;
     if(scenario.kind==='duplicate-id')people[11].playerId=1;
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaVersion:1,providerId:'authoritative-world',matchId:'123',season:1,competitionId:'IT-1',status:'completed',
      provenance:{kind:'authoritative',receiptHash:(scenario.kind==='receipt-mismatch'?'b':'a').repeat(64)},
      statistics:{ratingVersion:'test-rating-v1',home:{kind:scenario.kind==='fallback'?'team_fallback':'real_xi',players:scenario.kind==='fallback'?[]:people},away:{kind:'team_fallback',players:[]}}})});
    });
    await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('[data-match-detail]')?.dataset.matchLoad==='ready');
    assert.equal(await page.locator('[data-match-home-score]').textContent(),String(result.homeGoals));
    assert.equal(await page.locator('.app-match-lineup-player').count(),0);
    const response=page.waitForResponse('**/api/matches/123/stats');release();await response;
    if(scenario.shown){
     await page.waitForFunction(()=>document.querySelectorAll('.app-match-lineup-player').length===11);
     assert.equal(await page.locator('.app-match-lineup-player').first().textContent(),'Frozen Player 1');
     assert.equal(await page.locator('.app-match-lineup-player').first().getAttribute('title'),'ITA');
     const names=await page.locator('.app-match-lineup-player').allTextContents();
     assert.equal(names.length,11);
     assert.ok(names.every(name=>name.startsWith('Frozen Player ')),JSON.stringify({engine,scenario,names}));
     assert.equal(await page.locator('[data-match-lineup="home"] .app-match-lineup-rows').getAttribute('aria-hidden'),null);
    }else{
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     assert.equal(await page.locator('.app-match-lineup-player').count(),0,
      'unverified, unavailable or incomplete frozen starting XI stays hidden: '+scenario.kind);
    }
    assert.equal(await page.locator('.app-match-lineup-row').count(),22,'fixed XI geometry');
    assert.equal(await page.locator('[data-match-away-score]').textContent(),String(result.awayGoals));
    assert.equal(await page.locator('[data-match-home-score]').textContent(),String(result.homeGoals));
    if(scenario.kind==='extra-time'||scenario.kind==='penalties'){
     const messages=scenario.kind==='penalties'?
      {en:'Completed · Penalties 4–3',it:'Conclusa · Rigori 4–3',
       de:'Beendet · Elfmeterschießen 4–3',es:'Finalizado · Penaltis 4–3',
       fr:'Terminé · Tirs au but 4–3'}:
      {en:'Completed · After extra time',it:'Conclusa · Dopo i supplementari',
       de:'Beendet · Nach Verlängerung',es:'Finalizado · Tras la prórroga',
       fr:'Terminé · Après prolongation'};
     for(const [locale,expected] of Object.entries(messages)){
      await page.evaluate(code=>document.documentElement.lang=code,locale);
      await page.waitForFunction(expected=>document.querySelector('[data-match-overview="status"]')?.textContent===expected,expected);
     }
     assert.equal(await page.locator('.app-match-score-separator').textContent(),'–');
    }
    count++;
   }finally{release?.();await ctx.close()}
  }
  // Formation order follows frozen starting slots (not IDs); portraits
  // require the separately approved V4.2 asset key from the public player API.
  for(const width of [390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:900}});
   const page=await ctx.newPage();
   const played={...match,day:13,status:'completed',
    homeParticipant:{clubId:'IT-1'},awayParticipant:{clubId:'IT-2'},
    result:{homeGoals:1,awayGoals:0,resolution:'regulation',regulation:{home:1,away:0},
     extraTime:null,penalties:null,winnerClubId:'IT-1'},
    provenance:{kind:'authoritative',receiptHash:'a'.repeat(64)}};
   const wrap=(body)=>({status:200,contentType:'application/json',body:JSON.stringify(body)});
   const roles=['GK','RB','CB','CB','LB','CM','DM','CM','RW','ST','LW'];
   const people=roles.map((role,i)=>({
    playerId:11-i,name:'Frozen Player '+(11-i),nationality:'ITA',role,
    startingRole:role,startingSlot:i+1,started:true,minutes:90,goals:0,rating:6.5
   })).reverse(); // API order deliberately wrong.
   try{
    await page.route('**/matches/123',route=>route.fulfill({status:200,contentType:'text/html',
     body:applyPublishedMatchDocument(shell,played,'123')}));
    await page.route('**/api/matches/123',route=>route.fulfill(wrap(played)));
    await page.route('**/api/competitions/IT-1/seasons/1',route=>route.fulfill({status:503,body:'{}'}));
    await page.route('**/api/matches/123/stats',route=>route.fulfill(wrap({
     schemaVersion:1,providerId:'authoritative-world',matchId:'123',season:1,competitionId:'IT-1',
     status:'completed',provenance:played.provenance,
     statistics:{ratingVersion:'test-rating-v1',home:{kind:'real_xi',formation:'4-3-3',players:people},
      away:{kind:'team_fallback',formation:null,players:[]}}
    })));
    await page.route('**/api/players/*',route=>{
     const id=Number(route.request().url().split('/').pop());
     return route.fulfill(wrap({player:{id,portraitAssetKey:id===11?'assets/players/portraits/11.webp':null}}));
    });
    await page.route('**/assets/players/portraits/11.webp',route=>route.fulfill({
     status:200,contentType:'image/webp',
     body:readFileSync(new URL('../assets/players/portraits/44.webp',import.meta.url))
    }));
    let eventsRequested=0;
    await page.route('**/api/matches/123/events',route=>{eventsRequested++;return route.abort();});
    await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelectorAll('.app-match-lineup-player').length===11&&
     document.querySelector('[data-match-formation="home"]')?.textContent==='4-3-3');
    assert.deepEqual(await page.locator('.app-match-lineup-player').allTextContents(),
     roles.map((_,i)=>'Frozen Player '+(11-i)));
    assert.deepEqual(await page.locator('.app-match-lineup-role').allTextContents(),roles);
    assert.equal(await page.locator('[data-match-formation="away"]').textContent(),'');
    assert.equal(await page.locator('[data-match-events-panel]').count(),0);
    assert.equal(eventsRequested,0);
    assert.equal(await page.locator('[data-match-lineup-view="list"]').count(),2);
    assert.equal(await page.locator('[data-match-lineup-view="pitch"]:disabled').count(),2);
    const link=page.locator('.app-match-lineup-player').first();
    assert.equal(await link.evaluate(el=>el.parentElement.className),'app-match-lineup-name');
    assert.equal(await link.getAttribute('href'),'/players/11');
    await page.waitForFunction(()=>document.querySelector('.app-match-lineup-avatar[data-match-portrait-id="11"] img')?.naturalWidth>0);
    assert.equal(await page.locator('.app-match-lineup-avatar[data-match-portrait-id="11"]').getAttribute('data-photo-ready'),'true');
    assert.equal(await page.locator('.app-match-lineup-avatar img').count(),1,
     'only public V4.2-approved faces may be shown');
    const layout=await page.evaluate(()=>{
     const pitch=document.querySelector('[data-match-pitch]');
     const frame=document.querySelector('.app-match-stage');
     const columns=[...frame.children].map(el=>el.getBoundingClientRect().width);
     return {green:getComputedStyle(pitch).backgroundColor,columns,
      overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.equal(layout.green,'rgb(32, 92, 67)');
    if(width>1000)assert.ok(layout.columns[0]>layout.columns[1]*.38,JSON.stringify(layout));
    assert.ok(layout.overflow<=1,JSON.stringify({engine,width,layout}));
    count++;
   }finally{await ctx.close()}
  }
  // Bracket reservations are typed dependencies, not speculative clubs.
  {
   const ctx=await browser.newContext({viewport:{width:390,height:900}});
   const page=await ctx.newPage();
   const reserved={...match,stageId:'playoff',round:null,day:31,status:'awaiting_participants',
    participantA:{kind:'leagueRank',rank:5},participantB:{kind:'tieWinner',tieId:'playoff-sf-1'},
    homeParticipant:null,awayParticipant:null,result:null,venue:null,kickoff:null,
    provenance:{kind:'authoritative',receiptHash:null}};
   const html=applyPublishedMatchDocument(shell,reserved,'123');
   try{
    await page.route('**/matches/123',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.route('**/api/matches/123',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(reserved)}));
    await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('[data-match-detail]')?.dataset.matchLoad==='ready');
    assert.equal(await page.locator('[data-match-home-name]').textContent(),'#5');
    assert.equal(await page.locator('[data-match-home-name]').getAttribute('aria-label'),'League place 5');
    assert.equal(await page.locator('[data-match-away-name]').textContent(),'WIN');
    assert.equal(await page.locator('[data-match-away-name]').getAttribute('aria-label'),'Winner of tie playoff-sf-1');
    assert.equal(await page.locator('[data-match-side-name="home"]').textContent(),'League place 5');
    assert.equal(await page.locator('[data-match-side-name="away"]').textContent(),'Winner of tie playoff-sf-1');
    for(const side of ['home','away']){
     assert.equal(await page.locator('[data-match-'+side+'-name]').getAttribute('href'),null);
     assert.equal(await page.locator('[data-match-side-name="'+side+'"]').getAttribute('href'),null);
     assert.equal(await page.locator('[data-match-'+side+'-score]').textContent(),'');
    }
    await page.evaluate(()=>document.documentElement.lang='it');
    await page.waitForFunction(()=>document.querySelector('[data-match-away-name]')?.textContent==='VIN');
    assert.equal(await page.locator('[data-match-side-name="home"]').textContent(),'Posizione in campionato 5');
    assert.equal(await page.locator('[data-match-side-name="away"]').textContent(),'Vincente incontro playoff-sf-1');
    count++;
   }finally{await ctx.close()}
  }
  // Terminal 404/503 must not leave the initial loading indicators active.
  for(const failure of [{status:404,state:'missing',message:'Match not found or not published.'},
                      {status:503,state:'unavailable',message:'Match information is temporarily unavailable.'}]){
   const ctx=await browser.newContext({viewport:{width:390,height:900}});
   const page=await ctx.newPage();
   try{
    await page.route('**/matches/123',route=>route.fulfill({status:200,contentType:'text/html',body:decorated}));
    await page.route('**/api/matches/123',route=>route.fulfill({status:failure.status,contentType:'application/json',body:'{}'}));
    await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(state=>document.querySelector('[data-match-detail]')?.dataset.matchLoad===state,failure.state);
    assert.equal(await page.locator('[data-match-feedback]').textContent(),failure.message);
    assert.equal(await page.locator('[data-match-feedback]').isVisible(),true);
    assert.equal(await page.locator('.app-match-side-link').first().evaluate(el=>getComputedStyle(el,'::before').content),'none');
    assert.equal(await page.locator('.app-match-team-crest').first().evaluate(el=>getComputedStyle(el).visibility),'hidden');
    count++;
   }finally{await ctx.close()}
  }
  for(const theme of ['dark','light'])for(const device of cases){
   const ctx=await browser.newContext({viewport:{width:device.width,height:844},reducedMotion:'reduce'});
   try{
    await ctx.addInitScript(mode=>{
     localStorage.setItem('football-architect:theme',mode);
    },theme);
    const page=await ctx.newPage();
    // Keep the real CSS, theme bootstrapping and other shell resources. Prevent
    // match hydration to measure what the browser paints BEFORE asynchronous data.
    await page.route('**/matches/123',route=>route.fulfill({status:200,contentType:'text/html',body:decorated}));
    await page.route('**/assets/match-detail.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
    const response=await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    const sample=async()=>page.locator('.app-match-scoreboard').evaluate(el=>{
     const image=el.querySelector('.app-match-competition-logo img');
     const tile=el.querySelector('.app-match-competition-logo');
     const rect=el.getBoundingClientRect();
     const box=tile.getBoundingClientRect();
     const art=image?.getBoundingClientRect();
     const css=getComputedStyle(el);
     const bar=getComputedStyle(el,'::before');
     const tileStyle=getComputedStyle(tile);
     const separator=el.querySelector('.app-match-score-separator').getBoundingClientRect();
     const mainEl=el.closest('#main-content'),main=mainEl.getBoundingClientRect();
     const mainCss=getComputedStyle(mainEl);
     const mainContentMid=(main.left+parseFloat(mainCss.paddingLeft)+main.right-parseFloat(mainCss.paddingRight))/2;
     const section=el.closest('.app-match-page').getBoundingClientRect();
     return {width:rect.width,height:rect.height,
      sectionFillsMain:Math.abs(section.left-(main.left+parseFloat(mainCss.paddingLeft)))<=0.5&&Math.abs(section.right-(main.right-parseFloat(mainCss.paddingRight)))<=0.5,
      x:rect.x,viewportWidth:innerWidth,
      separatorCenterOffset:(separator.x+separator.width/2)-mainContentMid,
      surface:css.getPropertyValue('--app-match-surface').trim(),
      barColour:bar.backgroundColor,
      mode:document.documentElement.dataset.theme,
      badgeTheme:el.dataset.scoreboardTheme,
      tile:{x:box.x,right:box.right,w:box.width,h:box.height,borderColour:tileStyle.borderTopColor},
      badgeToCore:rect.x-box.right,
      barStartsAt:rect.x+parseFloat(bar.left),
      ivoryProjectsBeyondBar:(rect.x+parseFloat(bar.left))-box.x,
      badgeBarOverlap:box.right-(rect.x+parseFloat(bar.left)),
      art:art?{w:art.width,h:art.height,dx:art.x+art.width/2-box.x-box.width/2,
       dy:art.y+art.height/2-box.y-box.height/2}:null};
    });
    const first=await sample();
    assert.equal(first.surface,'#155F50',JSON.stringify({engine,theme,device,first}));
    assert.equal(first.mode,theme,JSON.stringify({engine,theme,device,first}));
    assert.equal(first.height,48);
    assert.equal(await page.locator('[data-match-card], .app-match-context, [data-match-visual-title]').count(),0);
    assert.equal(await page.locator('[data-match-view-selector], [data-match-view], [role="tab"], [role="tabpanel"]').count(),0);
    assert.equal(await page.locator('[data-match-overview-panel]').count(),1);
    assert.equal(await page.locator('[data-match-events-panel]').count(),0);
    assert.equal(await page.locator('[data-match-lineup-view="list"]').count(),2);
    assert.equal(await page.locator('[data-match-lineup-view="pitch"]:disabled').count(),2);
    assert.deepEqual(await page.locator('[data-match-formation]').allTextContents(),['','']);
    // Real rendered styles must survive conflict resolution. A missing ')'
    // in the Overview status grid can swallow every following CSS rule.
    const fieldStyles=await page.locator('.app-match-pitch-frame').evaluate(frame=>{
     const field=frame.querySelector('[data-match-pitch]');
     const overview=frame.querySelector('[data-match-overview-panel]');
     const status=frame.querySelector('.app-match-overview-row-status');
     const fieldCss=getComputedStyle(field),overviewCss=getComputedStyle(overview),statusCss=getComputedStyle(status);
     return {fieldColor:fieldCss.backgroundColor,fieldRadius:fieldCss.borderTopLeftRadius,
      overviewDisplay:overviewCss.display,overviewBackground:overviewCss.backgroundColor,
      statusDisplay:statusCss.display,statusColumns:statusCss.gridTemplateColumns.trim().split(' ')};
    });
    assert.equal(fieldStyles.fieldColor,'rgb(32, 92, 67)',JSON.stringify({engine,theme,device,fieldStyles}));
    assert.equal(fieldStyles.fieldRadius,'12px');
    assert.equal(fieldStyles.overviewDisplay,'flex');
    assert.notEqual(fieldStyles.overviewBackground,'rgba(0, 0, 0, 0)');
    assert.equal(fieldStyles.statusDisplay,'grid');
    assert.equal(fieldStyles.statusColumns.length,2,JSON.stringify({engine,theme,device,fieldStyles}));
    const fonts=await page.locator('[data-match-overview-panel]').evaluate(el=>({
     heading:parseFloat(getComputedStyle(el.querySelector('.app-match-overview-heading')).fontSize),
     label:parseFloat(getComputedStyle(el.querySelector('.app-match-info-label')).fontSize),
     value:parseFloat(getComputedStyle(el.querySelector('.app-match-info-value')).fontSize)
    }));
    assert.equal(fonts.heading,device.width<=620?15:18);
    assert.equal(fonts.label,device.width<=620?10:12);
    if(device.width<=620)assert.equal(fonts.value,12);
    else assert.ok(fonts.value>=13&&fonts.value<=17&&fonts.value<fonts.heading);
    const pitchBox=await page.locator('[data-match-pitch]').boundingBox();
    const scoreboardBox=await page.locator('.app-match-scoreboard').boundingBox();
    assert.ok(pitchBox&&scoreboardBox,JSON.stringify({engine,theme,device}));
    assert.ok(pitchBox.y>=scoreboardBox.y+scoreboardBox.height);
    assert.ok(Math.abs(pitchBox.width/pitchBox.height-105/68)<.02);
    const stage=await page.evaluate(()=>{
     const panels=[...document.querySelectorAll('.app-match-side')],pitch=document.querySelector('[data-match-pitch]');
     const positions=panels.map(p=>p.getBoundingClientRect());
     const field=pitch.getBoundingClientRect();
     const frame=document.querySelector('.app-match-stage').getBoundingClientRect();
     const overlay=document.querySelector('.app-match-pitch-overlay').getBoundingClientRect();
     const overview=document.querySelector('[data-match-overview-panel]').getBoundingClientRect();
     const main=document.querySelector('.app-match-page').getBoundingClientRect();
     const facts=panels.map(panel=>[...panel.querySelectorAll('.app-match-side-stats .app-match-side-fact:not([hidden])')].map(n=>n.getBoundingClientRect()));
     return {panels:panels.length,positions:positions.map(p=>({left:p.left,right:p.right,top:p.top,width:p.width,height:p.height})),
      stage:{left:frame.left,right:frame.right,width:frame.width,height:frame.height},
      main:{left:main.left,right:main.right,width:main.width},
      firstPaintNames:panels.map(p=>p.querySelector('.app-match-side-title').textContent),
      firstPaintNameLinks:panels.map(p=>{const a=p.querySelector('.app-match-side-link');return {hasHref:a.hasAttribute('href'),content:a.textContent}}),
      crestSlots:panels.map(p=>p.querySelectorAll('[data-match-side-crest]').length),
      facts: facts.map(pair=>pair.map(x=>({left:x.left,top:x.top,right:x.right}))),
      field:{left:field.left,right:field.right,top:field.top,width:field.width,height:field.height},
      overlay:{top:overlay.top,bottom:overlay.bottom,left:overlay.left,right:overlay.right},
      overview:{top:overview.top,bottom:overview.bottom,left:overview.left,right:overview.right},
      lineupCounts:panels.map(p=>p.querySelectorAll('.app-match-lineup-row').length),
      formCounts:panels.map(p=>p.querySelectorAll('.app-match-form-cell').length),
      formsHidden:panels.every(p=>p.querySelector('[data-match-form-fact]').hidden&&p.querySelector('.app-match-side-stats').dataset.formVisible==='false'),
      blank:panels.every(p=>p.querySelector('.app-match-position').textContent.trim()==='–')};
    });
    assert.equal(stage.panels,2);
    // Match boxes must be genuinely visible and dimensioned before JS hydrates.
    const boxes=await page.locator('.app-match-scoreboard,.app-match-side,.app-match-visual,[data-match-overview-panel],[data-match-pitch]')
      .evaluateAll(elements=>elements.map(el=>({
       display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,
       width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height
      })));
    assert.equal(boxes.length,6);
    assert.ok(boxes.every(b=>b.display!=='none'&&b.visibility==='visible'&&b.width>0&&b.height>0),
     JSON.stringify({engine,theme,device,boxes}));
    assert.ok(Math.abs(stage.stage.left-stage.main.left)<=1,JSON.stringify(stage));
    assert.ok(Math.abs(stage.stage.width-stage.main.width)<=1,JSON.stringify(stage));
    assert.deepEqual(stage.crestSlots,[1,1]);
    assert.ok(Math.abs(stage.overlay.top-stage.field.top)<=1&&Math.abs(stage.overlay.bottom-(stage.field.top+stage.field.height))<=1,JSON.stringify(stage));
    assert.ok(stage.overview.top>=stage.field.top-1&&stage.overview.bottom<=stage.field.top+stage.field.height+1,JSON.stringify(stage));
    assert.ok(stage.overview.left>=stage.field.left-1&&stage.overview.right<=stage.field.right+1,JSON.stringify(stage));
    assert.ok(stage.overview.right-stage.overview.left<stage.field.width*.98,JSON.stringify(stage));
    assert.ok(Math.abs((stage.overview.left+stage.overview.right)/2-(stage.field.left+stage.field.right)/2)<=1,JSON.stringify(stage));
    assert.ok(Math.abs((stage.overview.top+stage.overview.bottom)/2-(stage.field.top+stage.field.height/2))<=1,JSON.stringify(stage));
    assert.equal(await page.locator('[data-match-overview="competition"]').getAttribute('href'),null);
    assert.equal(await page.locator('.app-match-overview-row').count(),3);
    assert.equal(await page.locator('.app-match-pitch-frame').evaluate(el=>getComputedStyle(el).position),'relative');
    assert.equal(await page.locator('.app-match-pitch-overlay').evaluate(el=>getComputedStyle(el).position),'absolute');
    assert.deepEqual(await page.locator('[data-match-overview]').evaluateAll(els=>els.map(el=>el.textContent)),['','','','','','','']);
    assert.deepEqual(stage.firstPaintNames,['','']);
    assert.deepEqual(stage.firstPaintNameLinks,[{hasHref:false,content:''},{hasHref:false,content:''}]);
    for(let i=0;i<stage.facts.length;i++){
     const pair=stage.facts[i];
     assert.equal(pair.length,1);
     assert.ok(Math.abs((pair[0].left+pair[0].right)/2-(stage.positions[i].left+stage.positions[i].right)/2)<=1,JSON.stringify(stage));
    }
    assert.deepEqual(stage.lineupCounts,[11,11]);
    assert.deepEqual(stage.formCounts,[0,0]);
    assert.equal(stage.formsHidden,true);
    assert.equal(stage.blank,true);
    if(device.width>1000){
     assert.ok(stage.positions[0].right<=stage.field.left&&stage.field.right<=stage.positions[1].left,JSON.stringify(stage));
     assert.ok(stage.field.width<stage.positions[1].right-stage.positions[0].left);
     assert.ok(Math.abs(stage.positions[0].height-stage.stage.height)<=1,JSON.stringify(stage));
     assert.ok(Math.abs(stage.positions[1].height-stage.stage.height)<=1,JSON.stringify(stage));
    }else{
     assert.ok(stage.positions.every(p=>p.top>=stage.field.top+pitchBox.height));
     assert.ok(Math.abs(stage.positions[0].width-stage.positions[1].width)<1);
    }
    assert.equal(await page.locator('.app-match-scoreboard-meta, [data-match-status], [data-match-extra]').count(),0,
     'no loading or sporting-status captions under the scoreboard');
    assert.equal(first.sectionFillsMain,true,'match section must share the main content width');
    assert.ok(Math.abs(first.separatorCenterOffset)<=0.5,JSON.stringify({engine,theme,device,first}));
    assert.ok(first.x>=-0.5,JSON.stringify({engine,theme,device,first}));
    assert.ok(first.x+first.width<=first.viewportWidth+0.5,JSON.stringify({engine,theme,device,first}));
    for(const selector of ['[data-match-home-score]','[data-match-away-score]'])
     assert.equal(await page.locator(selector).textContent(),'',selector+' must begin blank');
    assert.equal(await page.locator('.app-match-score-separator').textContent(),'–',
     'the centre dash remains visible before hydration');
    // The match section adds no artificial top space in either breakpoint.
    assert.equal(await page.locator('.app-match-page').evaluate(el=>getComputedStyle(el).paddingTop),'0px');
    // At 320px the core shrinks to 204px, leaving 56px for the logo and
    // the 8px tile/strip gap. The five-track group remains exactly centered.
    const expectedBoardWidth=Math.min(254,device.width-116);
    assert.ok(Math.abs(first.width-expectedBoardWidth)<=1,
     JSON.stringify({engine,theme,device,first,expectedBoardWidth}));
    assert.equal(first.tile.w,48);assert.equal(first.tile.h,48);
    assert.ok(first.tile.x>=-0.5&&first.tile.right<=first.viewportWidth+0.5,
     JSON.stringify({engine,theme,device,first}));
    assert.ok(Math.abs(first.badgeToCore)<=0.5,
     'The independent ivory tile must touch the symmetric scoreboard core');
    assert.ok(Math.abs(first.ivoryProjectsBeyondBar-12)<=0.5,
     'Ivory tile must project 12px beyond the painted bar, like the original');
    assert.ok(Math.abs(first.badgeBarOverlap-36)<=0.5,
     'The painted bar must extend 36px behind the independent ivory tile');
    // Skeletons reserve a typographically proportional block centred on the
    // same two axes as the hydrated abbreviations, without a layout shift.
    const skeletons=await page.locator('.app-match-score-line').evaluate(grid=>{
     const row=grid.getBoundingClientRect();
     return [...grid.querySelectorAll('.app-match-team-slot')].map((cell,index)=>{
      const bar=cell.querySelector('.app-skeleton-bar');
      const b=bar?.getBoundingClientRect(),box=cell.getBoundingClientRect();
      return b?{width:b.width,height:b.height,
       toScore:index===0?box.right-b.right:b.left-box.left,
       justify:getComputedStyle(cell).justifyContent,
       cellHeight:box.height,
       dy:(b.y+b.height/2)-(row.y+row.height/2)}:null;
     });
    });
    const isMobile=device.width<=480;
    for(const [i,s] of skeletons.entries()){
     assert.ok(s,JSON.stringify({engine,theme,device,skeletons}));
     const expectedSkeleton=isMobile?Math.min(50,(first.width-82)/2-12):54;
     assert.ok(Math.abs(s.width-expectedSkeleton)<=0.5,JSON.stringify({engine,theme,device,skeletons,expectedSkeleton}));
     assert.equal(s.height,isMobile?18:20);
     assert.equal(s.justify,i===0?'flex-end':'flex-start');
     assert.equal(s.cellHeight,48);
     assert.ok(Math.abs(s.toScore-4)<=0.5&&Math.abs(s.dy)<=0.5,JSON.stringify({engine,theme,device,skeletons}));
    }
    // Two-digit result columns and centred official three-character
    // abbreviations stay inside the unchanged 48px-high scoreboard.
    await page.evaluate(()=>{
     document.querySelector('[data-match-home-name]').textContent='TRA';
     document.querySelector('[data-match-away-name]').textContent='UNI';
     document.querySelector('[data-match-home-score]').textContent='12';
     document.querySelector('[data-match-away-score]').textContent='34';
    });
    const layout=await page.locator('.app-match-score-line').evaluate(grid=>{
     const names=[grid.querySelector('[data-match-home-name]'),grid.querySelector('[data-match-away-name]')];
     const slots=[grid.querySelector('.app-match-team-home'),grid.querySelector('.app-match-team-away')];
     const scores=[grid.querySelector('[data-match-home-score]'),grid.querySelector('[data-match-away-score]')];
     const center=grid.querySelector('.app-match-score-separator');
     const row=grid.getBoundingClientRect();
     const [leftScore,rightScore]=scores.map(el=>el.getBoundingClientRect());
     const separatorBox=center.getBoundingClientRect();
     const rangeFor=el=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect()};
     const ivoryRight=grid.closest('.app-match-scoreboard').querySelector('.app-match-competition-logo').getBoundingClientRect().right;
     const homePadding=parseFloat(getComputedStyle(slots[0]).paddingLeft);
     const awayPadding=parseFloat(getComputedStyle(slots[1]).paddingRight);
     const homeBox=slots[0].getBoundingClientRect(),awayBox=slots[1].getBoundingClientRect();
     const homeText=rangeFor(scores[0]),awayText=rangeFor(scores[1]),dashText=rangeFor(center);
     const separatorStyle=getComputedStyle(center);
     const nameText=names.map(el=>rangeFor(el));
     const nameScoreGaps={home:leftScore.left-nameText[0].right,away:nameText[1].left-rightScore.right};
     return {nameScoreGaps,ivoryToHome:nameText[0].left-ivoryRight,homePadding,awayPadding,
      coreMid:row.left+row.width/2,separatorMid:separatorBox.left+separatorBox.width/2,
      homeTrackWidth:homeBox.width,awayTrackWidth:awayBox.width,
      scoreTracksMirror:Math.abs(leftScore.width-rightScore.width),
      teamTracksMirror:Math.abs((homeBox.left+awayBox.right)/2-(separatorBox.left+separatorBox.width/2)),
      names:names.map((el,i)=>{const rect=el.getBoundingClientRect(),style=getComputedStyle(el),slot=getComputedStyle(slots[i]);return {
      align:style.textAlign,display:style.display,vertical:slot.alignItems,justify:slot.justifyContent,
      font:parseFloat(style.fontSize),fits:el.scrollWidth<=el.clientWidth+1,
      height:rect.height,cellHeight:slots[i].getBoundingClientRect().height,
      centerOffset:(rect.y+rect.height/2)-(row.y+row.height/2)
     }}),
      scores:scores.map(el=>({width:el.getBoundingClientRect().width,text:el.textContent,align:getComputedStyle(el).textAlign})),
      dashStyle:{font:parseFloat(separatorStyle.fontSize),color:separatorStyle.color,opacity:separatorStyle.opacity},
      teamColor:getComputedStyle(names[0]).color,
      glyphGaps:{home:dashText.left-homeText.right,away:awayText.left-dashText.right},
      columnGap:getComputedStyle(grid).columnGap,
      scoreToDash:{left:separatorBox.left-leftScore.right,right:rightScore.left-separatorBox.right},
      separatorWidth:separatorBox.width,
      separator:center.textContent.trim(),height:grid.getBoundingClientRect().height};
    });
    for(const [i,name] of layout.names.entries()){
     // A flex item is blockified by CSS layout: inline-block specified on
     // the child anchor legitimately computes to block within its flex slot.
     // Its intrinsic text-sized box, not the computed display keyword,
     // determines the actual clickable area (asserted below).
     assert.equal(name.align,'center');assert.equal(name.display,'block');assert.equal(name.vertical,'center');
     assert.equal(name.justify,i===0?'flex-end':'flex-start');
     assert.equal(name.font,isMobile?24:26);assert.equal(name.fits,true,JSON.stringify({engine,theme,device,layout}));
     assert.equal(name.cellHeight,48);assert.ok(name.height<48);
     assert.ok(Math.abs(name.centerOffset)<=0.5,JSON.stringify({engine,theme,device,layout}));
    }
    for(const score of layout.scores){assert.ok(score.width>=(isMobile?32:35)-0.5);assert.equal(score.text.length,2);}
    assert.deepEqual(layout.scores.map(s=>s.align),['right','left']);
    // Each abbreviation has exactly its 4px edge inset; no unneeded
    // flexible whitespace remains between the name glyph and score track.
    assert.ok(layout.nameScoreGaps.home>=3.5&&layout.nameScoreGaps.home<=4.5,JSON.stringify({engine,theme,device,layout}));
    assert.equal(layout.homePadding,8,'Home track retains its 8px outer inset');
    assert.equal(layout.awayPadding,8,'Away track mirrors the 8px Home outer inset');
    assert.ok(Math.abs(layout.coreMid-layout.separatorMid)<=0.5,
     'Central dash must align precisely with the midpoint of the five-track core');
    assert.ok(Math.abs(layout.homeTrackWidth-layout.awayTrackWidth)<=0.5,
     'Team name tracks must have identical widths');
    assert.ok(layout.scoreTracksMirror<=0.5&&layout.teamTracksMirror<=0.5,
     'Scores and team tracks must mirror around the central separator');
    assert.ok(layout.ivoryToHome>=7.5,JSON.stringify({engine,theme,device,layout}));
    assert.ok(layout.nameScoreGaps.away>=3.5&&layout.nameScoreGaps.away<=4.5,JSON.stringify({engine,theme,device,layout}));
    assert.equal(layout.dashStyle.font,isMobile?19:21);
    assert.equal(layout.dashStyle.opacity,'1');
    if(theme==='dark')assert.equal(layout.dashStyle.color,'rgb(255, 255, 255)');
    else assert.equal(layout.dashStyle.color,layout.teamColor);
    assert.ok(layout.glyphGaps.home>=2&&layout.glyphGaps.away>=2,JSON.stringify({engine,theme,device,layout}));
    assert.equal(layout.columnGap,'0px');
    assert.ok(layout.separatorWidth>=(isMobile?18:20)-0.5,JSON.stringify({engine,theme,device,layout}));
    assert.ok(Math.abs(layout.scoreToDash.left)<=0.5&&Math.abs(layout.scoreToDash.right)<=0.5,JSON.stringify({engine,theme,device,layout}));
    assert.equal(layout.separator,'–');assert.equal(layout.height,48);
    assert.equal(first.badgeTheme,'competition');
    // The image is intentionally absent until the authorized match payload
    // arrives: the reserved badge itself must still be fully sized and centred.
    assert.equal(first.art,null);
    const light=theme==='light';
    assert.ok(first.barColour&&!['transparent','rgba(0, 0, 0, 0)'].includes(first.barColour));
    if(!light){
     assert.equal(first.barColour,'rgb(21, 95, 80)');
     assert.equal(first.tile.borderColour,'rgb(36, 48, 57)');
    }else{
     assert.notEqual(first.barColour,'rgb(36, 48, 57)');
     assert.equal(first.tile.borderColour,'rgb(21, 95, 80)');
    }
    // Render the real official SVG inside the reserved tile to verify the
    // final 44px artwork is precisely centred without changing box geometry.
    await page.evaluate(async()=>{
     const slot=document.querySelector('[data-match-competition-logo]');
     const img=document.createElement('img');
     img.width=44;img.height=44;img.alt='';
     img.src='/assets/divisions/it-1-lega-federale/compact.svg';
     slot.append(img);
     await img.decode();
    });
    const withImage=await sample();
    assert.ok(withImage.art,JSON.stringify({engine,theme,device}));
    assert.equal(withImage.art.w,44);assert.equal(withImage.art.h,44);
    assert.ok(Math.abs(withImage.art.dx)<=0.5,JSON.stringify({engine,theme,device,withImage}));
    assert.ok(Math.abs(withImage.art.dy)<=0.5,JSON.stringify({engine,theme,device,withImage}));
    // A refresh must begin on the correct competition colour, too.
    await page.reload({waitUntil:'domcontentloaded'});
    const second=await sample();
    assert.equal(second.surface,first.surface);
    assert.equal(second.barColour,first.barColour);
    assert.equal(second.mode,theme);
    assert.equal(second.badgeTheme,'competition');
    assert.equal(second.tile.borderColour,first.tile.borderColour);
    count++;
   }finally{await ctx.close()}
  }
  // Exercise the real match controller in a fresh document, not just the
  // first-paint shell. Stale scores supplied for non-completed statuses must
  // never display numbers or the centre dash.
  for(const theme of ['dark','light']){
   const ctx=await browser.newContext({viewport:{width:390,height:844}});
   try{
    await ctx.addInitScript(mode=>localStorage.setItem('football-architect:theme',mode),theme);
    const page=await ctx.newPage();
    let currentStatus='scheduled';
    await page.route('**/matches/123',route=>route.fulfill({
     status:200,contentType:'text/html',body:decorated
    }));
    await page.route('**/api/matches/123',route=>route.fulfill({
     status:200,contentType:'application/json',
     body:JSON.stringify({...match,status:currentStatus,day:16,stageId:'league',
      homeParticipant:currentStatus==='awaiting_participants'?null:{clubId:'IT-1'},
      awayParticipant:{clubId:'IT-2'},
      // A scheduled match may not reveal stale score data.
      result:currentStatus==='completed'?{homeGoals:12,awayGoals:3}:{homeGoals:9,awayGoals:9},
      kickoff:currentStatus==='postponed'?'2026-11-25T19:30:00+01:00':
       currentStatus==='cancelled'?'not-a-date':null,
      venue:currentStatus==='postponed'?{name:'Stadio Aurora'}:
       currentStatus==='cancelled'?{name:''}:null,
      neutral:currentStatus==='in_progress'})

    }));
    const officialSource='season:1:IT-1:N01:IT-1:IT-7';
    const leagueFixtures=[{"id":officialSource,"round":1,"phaseId":"league","day":1,"homeClubId":"IT-1","awayClubId":"IT-7","competitionId":"IT-1","result":{"homeGoals":2,"awayGoals":0}},{"id":"f2","day":2,"homeClubId":"IT-2","awayClubId":"IT-6","competitionId":"IT-1","result":{"homeGoals":2,"awayGoals":1}},{"id":"f3","day":4,"homeClubId":"IT-4","awayClubId":"IT-1","competitionId":"IT-1","result":{"homeGoals":1,"awayGoals":1}},{"id":"f4","day":5,"homeClubId":"IT-5","awayClubId":"IT-2","competitionId":"IT-1","result":{"homeGoals":3,"awayGoals":2}},{"id":"f5","day":7,"homeClubId":"IT-1","awayClubId":"IT-5","competitionId":"IT-1","result":{"homeGoals":0,"awayGoals":2}},{"id":"f6","day":8,"homeClubId":"IT-2","awayClubId":"IT-6","competitionId":"IT-1","result":{"homeGoals":0,"awayGoals":0}},{"id":"f7","day":11,"homeClubId":"IT-9","awayClubId":"IT-1","competitionId":"IT-1","result":{"homeGoals":0,"awayGoals":1}},{"id":"f8","day":12,"homeClubId":"IT-7","awayClubId":"IT-2","competitionId":"IT-1","result":{"homeGoals":0,"awayGoals":1}},{"id":"f9","day":13,"homeClubId":"IT-1","awayClubId":"IT-10","competitionId":"IT-1","result":{"homeGoals":2,"awayGoals":0}},{"id":"f10","day":14,"homeClubId":"IT-2","awayClubId":"IT-8","competitionId":"IT-1","result":{"homeGoals":2,"awayGoals":3}},{"id":"f11","day":16,"homeClubId":"IT-1","awayClubId":"IT-2","competitionId":"IT-1","result":{"homeGoals":99,"awayGoals":99}},{"id":"f12","day":19,"homeClubId":"IT-1","awayClubId":"IT-4","competitionId":"IT-1","result":{"homeGoals":99,"awayGoals":0}}];
    await page.route('**/api/competitions/IT-1/seasons/1',route=>route.fulfill({
     status:200,contentType:'application/json',
     body:JSON.stringify({
      schemaVersion:1,providerId:'authoritative-world',competitionId:'IT-1',selectedSeason:1,
      status:'partial',provenance:{kind:'authoritative'},
      data:{season:1,seasonState:{day:currentStatus==='completed'?20:14},
       standings:{rows:[{clubId:'IT-1',rank:3,played:5},{clubId:'IT-2',rank:5,played:5}]},
       fixtures:currentStatus==='postponed'?leagueFixtures.filter(f=>f.id==='f1'||f.id==='f3'):
        currentStatus==='cancelled'?[]:leagueFixtures}
     })
    }));
    await page.route('**/api/matches/seasons/1/competitions/IT-1',route=>route.fulfill({
     status:200,contentType:'application/json',body:JSON.stringify({
      schemaVersion:1,providerId:'authoritative-world',status:'published',
      season:1,competitionId:'IT-1',provenance:{kind:'authoritative'},
      fixtures:[{matchId:'901',phaseId:'league',sourceFixtureId:officialSource,
       marker:'N01',day:1,round:1}]
     })
    }));
    for(const status of ['awaiting_participants','scheduled','in_progress','postponed','cancelled','completed']){
     currentStatus=status;
     const response=await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
     assert.equal(response?.status(),200,engine+' '+theme+' '+status);
     await page.waitForFunction(()=>document.querySelector('[data-match-detail]')?.dataset.matchLoad==='ready');
     if(status!=='awaiting_participants'){
      await page.waitForFunction(name=>document.querySelector('[data-match-side-title="home"]')?.textContent===name,
       officialClub('IT-1').primaryName);
      assert.deepEqual(await page.locator('[data-match-side-title]').allTextContents(),
       [officialClub('IT-1').primaryName,officialClub('IT-2').primaryName]);
      const sideLinks=await page.locator('[data-match-side-name]').evaluateAll(els=>els.map(el=>({
       href:el.hasAttribute('href')?new URL(el.getAttribute('href'),location.href).pathname:null,
       target:el.getAttribute('target'),rel:el.getAttribute('rel'),
       decoration:getComputedStyle(el).textDecorationLine,
       label:el.textContent
      })));
      assert.deepEqual(sideLinks,[
       {href:'/clubs/it/1/overview',target:'_blank',rel:'noopener noreferrer',decoration:'none',label:officialClub('IT-1').primaryName},
       {href:'/clubs/it/2/overview',target:'_blank',rel:'noopener noreferrer',decoration:'none',label:officialClub('IT-2').primaryName}
      ]);
      assert.deepEqual(await page.locator('[data-match-side-crest]').evaluateAll(els=>els.map(el=>el.dataset.clubCrest)),
       ['IT-1','IT-2']);
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-match-side-crest]')].every(
       el=>el.querySelector('.app-club-crest-image')));
      assert.deepEqual(await page.locator('[data-match-side-crest] .app-club-crest-image').evaluateAll(els=>els.map(el=>
       new URL(el.src).pathname)),['/assets/clubs/IT/1/crest.svg','/assets/clubs/IT/2/crest.svg']);
     }
     assert.equal(await page.locator('.app-match-scoreboard-meta, [data-match-status], [data-match-extra]').count(),0,
      'no scheduled/playing/completed/extra-time caption should occupy the former line');
     if(status==='awaiting_participants'){
      assert.equal(await page.locator('[data-match-overview="stadium"]').textContent(),'',
       'Unknown home team cannot imply a home stadium');
      const unresolved=page.locator('[data-match-home-name]');
      assert.equal(await unresolved.getAttribute('href'),null);
      assert.equal(await unresolved.getAttribute('target'),null);
      assert.equal(await unresolved.getAttribute('rel'),null);
      const unresolvedSide=page.locator('[data-match-side-name="home"]');
      assert.equal(await unresolvedSide.getAttribute('href'),null);
      assert.equal(await unresolvedSide.getAttribute('target'),null);
      assert.equal(await unresolvedSide.getAttribute('rel'),null);
     }
     const state=await page.evaluate(()=>{
      const root=document.querySelector('[data-match-detail]');
      const get=selector=>root.querySelector(selector);
      const scores=['home','away'].map(side=>get('[data-match-'+side+'-score]'));
      const dash=get('.app-match-score-separator');
      const main=root.closest('#main-content'),mainRect=main.getBoundingClientRect(),pad=getComputedStyle(main);
      const mainMid=(mainRect.left+parseFloat(pad.paddingLeft)+mainRect.right-parseFloat(pad.paddingRight))/2;
      const sep=dash.getBoundingClientRect();
      return {text:[scores[0].textContent,scores[1].textContent,dash.textContent],
       hidden:scores.map(node=>node.getAttribute('aria-hidden')),
       centreOffset:(sep.left+sep.width/2)-mainMid};
     });
     assert.deepEqual(state.text,status==='completed'?['12','3','–']:['','','–'],
      JSON.stringify({engine,theme,status,state}));
     assert.deepEqual(state.hidden,status==='completed'?['false','false']:['true','true']);
     assert.equal(await page.locator('[data-match-card], .app-match-context, [data-match-visual-title]').count(),0);
     assert.equal(await page.locator('[data-match-pitch] svg').count(),1);
     if(status==='scheduled'){
      await page.waitForFunction(()=>document.querySelector('[data-match-position="home"]')?.textContent==='3rd');
      assert.deepEqual(await page.locator('[data-match-position]').allTextContents(),['3rd','5th']);
      const form=await page.locator('[data-match-form]').evaluateAll(els=>els.map(el=>
       [...el.children].map(x=>x.dataset.outcome||'-').join('')
      ));
      assert.deepEqual(form,['wdlww','wldwl']);
      await page.waitForFunction(()=>document.querySelector('[data-match-form="home"] a.app-match-form-control')?.getAttribute('href')==='/matches/901');
      const firstForm=page.locator('[data-match-form="home"] a.app-match-form-control').first();
      await firstForm.hover();
      await page.waitForFunction(()=>document.getElementById('app-match-published-form-tooltip')?.hidden===false);
      assert.match(await page.locator('#app-match-published-form-tooltip').textContent(),/IT-1|Frozen|2/);
      const formAlignment=await page.locator('[data-match-side="home"]').evaluate(side=>{
       const pos=side.querySelector('.app-match-position').getBoundingClientRect();
       const form=side.querySelector('.app-match-form').getBoundingClientRect();
       return {top:Math.abs(pos.top-form.top),height:Math.abs(pos.height-form.height)};
      });
      assert.ok(formAlignment.top<=1&&formAlignment.height<=1,JSON.stringify({engine,formAlignment}));
      await page.mouse.move(0,0);

      assert.equal(await page.locator('[data-match-overview="season"]').textContent(),'1');
      assert.equal(await page.locator('[data-match-overview="round"]').textContent(),'1');
      assert.ok((await page.locator('[data-match-overview="competition"]').textContent()).length>0);
      const overviewCompetition=page.locator('[data-match-overview="competition"]');
      assert.equal(new URL(await overviewCompetition.getAttribute('href'),page.url()).pathname,'/competitions/it-1/fixtures');
      assert.equal(await overviewCompetition.getAttribute('target'),'_blank');
      assert.equal(await overviewCompetition.getAttribute('rel'),'noopener noreferrer');
      assert.equal(await overviewCompetition.evaluate(el=>getComputedStyle(el).textDecorationLine),'none');
      assert.equal(await page.locator('[data-match-overview="date"]').textContent(),'');
      assert.equal(await page.locator('[data-match-overview="stadium"]').textContent(),'Stadio dei Navigli');
      assert.equal(await page.locator('[data-match-overview="status"]').textContent(),'Scheduled');
      assert.equal(await page.locator('[data-match-overview-panel]').count(),1);
      assert.equal(await page.locator('[data-match-view-selector], [data-match-view], [data-match-empty]').count(),0);
      // Language changes update glyphs, not recorded results.
      await page.evaluate(()=>document.documentElement.lang='it');
      await page.waitForFunction(()=>document.querySelector('[data-match-label="position"]')?.textContent==='Posizione');
      assert.deepEqual(await page.locator('[data-match-position]').allTextContents(),['3º','5º']);
      assert.deepEqual(await page.locator('[data-match-lineup-view="list"]').allTextContents(),['Elenco','Elenco']);
      assert.deepEqual(await page.locator('[data-match-lineup-view="pitch"]').allTextContents(),['Campo','Campo']);
      assert.equal(await page.locator('[data-match-side-title="home"]').textContent(),officialClub('IT-1').primaryName,
       'Localization never replaces an official club name with a generic Home label');
      assert.deepEqual(await page.locator('[data-match-form="home"] .app-match-form-cell').allTextContents(),['V','N','P','V','V']);
      assert.equal(await page.locator('[data-match-overview="status"]').textContent(),'Programmata');
      assert.equal(await page.locator('[data-match-overview-panel]').getAttribute('aria-label'),'Panoramica');
      await page.evaluate(()=>document.documentElement.lang='en');
     }
     if(status==='in_progress'){
      assert.equal(await page.locator('[data-match-overview="stadium"]').textContent(),'',
       'Neutral matches must not inherit a registered home stadium');
     }
     if(status==='postponed'){
      assert.match(await page.locator('[data-match-overview="date"]').textContent(),/25.*Nov.*2026/i);
      assert.equal(await page.locator('[data-match-overview="stadium"]').textContent(),'Stadio Aurora');
      await page.waitForFunction(()=>document.querySelector('[data-match-form="home"]')?.children.length===2);
      assert.deepEqual(await page.locator('[data-match-form="home"] .app-match-form-cell').evaluateAll(els=>els.map(el=>el.dataset.outcome)),['w','d']);
      assert.equal(await page.locator('[data-match-form-fact="home"]').evaluate(el=>el.hidden),false);
      assert.equal(await page.locator('[data-match-form-fact="away"]').evaluate(el=>el.hidden),true);
      assert.equal(await page.locator('[data-match-form="away"] .app-match-form-cell').count(),0);
     }
     if(status==='cancelled'){
      assert.equal(await page.locator('[data-match-overview="date"]').textContent(),'');
      assert.equal(await page.locator('[data-match-overview="stadium"]').textContent(),'Stadio dei Navigli');
      await page.waitForFunction(()=>document.querySelector('[data-match-position="home"]')?.textContent==='3');
      assert.deepEqual(await page.locator('[data-match-form-fact]').evaluateAll(els=>els.map(el=>el.hidden)),[true,true]);
      assert.equal(await page.locator('.app-match-form-cell').count(),0);
     }
     if(status==='completed'){
      await page.waitForFunction(()=>document.querySelector('[data-match-form="home"]')?.children[0]?.dataset.outcome==='w');
      assert.deepEqual(await page.locator('[data-match-position]').allTextContents(),['–','–'],
       'Historical positions cannot be inferred from later standings');
     }
     assert.ok(Math.abs(state.centreOffset)<=0.5,JSON.stringify({engine,theme,status,state}));
     // Real authorised club IDs link to club pages even before a score
     // exists. Underlining must neither move text nor change on hover.
     if(status==='scheduled'){
      const links=page.locator('[data-match-home-name], [data-match-away-name]');
      const linked=await links.evaluateAll(nodes=>nodes.map(el=>{
       const style=getComputedStyle(el);
       const range=document.createRange();range.selectNodeContents(el);
       const withUnderline=range.getBoundingClientRect();
       const originalDecoration=style.textDecorationLine;
       const outer=el.getBoundingClientRect();
       const slot=el.parentElement.getBoundingClientRect();
       return {href:el.hasAttribute('href')?new URL(el.getAttribute('href'),location.href).pathname:null,
        underlined:originalDecoration,outerHeight:outer.height,
        slotHeight:slot.height,slotWidth:slot.width,linkWidth:outer.width,
        textWidth:withUnderline.width,
        dy:(outer.y+outer.height/2)-(slot.y+slot.height/2)};
      }));
      assert.deepEqual(linked.map(x=>x.href),['/clubs/it/1/overview','/clubs/it/2/overview']);
      for(const link of linked){
       assert.equal(link.underlined,'none');
       assert.equal(link.slotHeight,48);
       assert.ok(link.outerHeight<48&&link.linkWidth<link.slotWidth&&Math.abs(link.dy)<=0.5,
        JSON.stringify({engine,theme,linked}));
       assert.ok(Math.abs(link.textWidth-link.linkWidth)<=1,JSON.stringify({engine,theme,linked}));
      }
      const home=page.locator('[data-match-home-name]');
      const beforeHover=await home.evaluate(el=>({
       decoration:getComputedStyle(el).textDecorationLine,
       overflow:getComputedStyle(el).overflow,
       slotOverflow:getComputedStyle(el.parentElement).overflow,
       lineHeight:getComputedStyle(el).lineHeight,
       linkHeight:el.getBoundingClientRect().height,
       slotHeight:el.parentElement.getBoundingClientRect().height,
       verticalRoom:el.parentElement.getBoundingClientRect().bottom-el.getBoundingClientRect().bottom
      }));
      assert.equal(beforeHover.decoration,'none');
      assert.equal(beforeHover.overflow,'visible','the anchor must not clip underline glyph pixels');
      assert.equal(beforeHover.slotOverflow,'hidden','outer slot still contains off-column text');
      assert.ok(beforeHover.verticalRoom>=4,JSON.stringify({engine,theme,beforeHover}));
      const unhovered=await home.boundingBox();
      await home.hover();
      assert.equal(await home.evaluate(el=>getComputedStyle(el).textDecorationLine),'underline');
      const thickness=await home.evaluate(el=>getComputedStyle(el).textDecorationThickness);
      assert.ok(thickness==='.1em'||thickness==='0.1em'||Math.abs(parseFloat(thickness)-2.4)<0.15,
       JSON.stringify({engine,theme,thickness}));
      assert.equal(await home.evaluate(el=>getComputedStyle(el).textUnderlineOffset),'3px');
      const hovered=await home.boundingBox();
      for(const key of ['x','y','width','height'])assert.ok(Math.abs(hovered[key]-unhovered[key])<=0.5,
       JSON.stringify({engine,theme,key,hovered,unhovered}));
      // Empty regions in the 48px cell must neither hover nor navigate.
      const slot=await page.locator('.app-match-team-home').boundingBox();
      const outsideX=slot.x+3;
      const outsideY=slot.y+slot.height/2;
      assert.ok(outsideX<unhovered.x-1,JSON.stringify({engine,theme,slot,unhovered}));
      await page.mouse.move(outsideX,outsideY);
      assert.equal(await home.evaluate(el=>getComputedStyle(el).textDecorationLine),'none');
      await page.mouse.click(outsideX,outsideY);
      assert.equal(new URL(page.url()).pathname,'/matches/123');
      // Each real link must create a new tab without navigating the match
      // page. The competition tile is tested alongside both club labels.
      for(const item of [
       {link:page.locator('[data-match-competition-link]'),path:'/competitions/it-1/fixtures'},
       {link:home,path:'/clubs/it/1/overview'},
       {link:page.locator('[data-match-away-name]'),path:'/clubs/it/2/overview'}
      ]){
       const info=await item.link.evaluate(el=>({target:el.target,rel:el.rel,href:el.getAttribute('href')}));
       assert.equal(info.target,'_blank',JSON.stringify({engine,theme,info}));
       assert.ok(info.rel.split(/\s+/).includes('noopener')&&info.rel.split(/\s+/).includes('noreferrer'),
        JSON.stringify({engine,theme,info}));
       const popupReady=ctx.waitForEvent('page');
       await item.link.click();
       const newTab=await popupReady;
       // The link contract requires the destination URL, not the unrelated
       // destination page's full load event (which can fail internally in WebKit).
       await newTab.waitForURL(url=>url.pathname===item.path,{waitUntil:'commit'});
       assert.equal(new URL(page.url()).pathname,'/matches/123');
       await newTab.close();
      }
     }
    }
   }finally{await ctx.close()}
  }

  // A verified server read must not turn into a second match API call on load.
  // The separate competition snapshot still serves pre-match rank and form.
  const hydrated={...match,status:'scheduled',day:16,
   homeParticipant:{clubId:'IT-1'},awayParticipant:{clubId:'IT-2'},result:null};
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  try{
   const page=await ctx.newPage();
   let withBootstrap=true,matchCalls=0,snapshotCalls=0;
   const catalogRequests=[];
   for(const pattern of ['**/clubs/_shared/manifest.json','**/competitions/_shared/manifest.json','**/data/divisions.json']){
    await page.route(pattern,route=>{catalogRequests.push(route.request().url());return route.abort();});
   }
   await page.route('**/matches/123',route=>route.fulfill({status:200,
    contentType:'text/html',body:withBootstrap?
     applyPublishedMatchDocument(shell,hydrated,'123'):decorated}));
   await page.route('**/api/matches/123',route=>{
    matchCalls++;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(hydrated)});
   });
   await page.route('**/api/competitions/IT-1/seasons/1',route=>{
    snapshotCalls++;
    return route.fulfill({status:503,contentType:'application/json',body:'{}'});
   });
   const snapshotRequest=page.waitForRequest('**/api/competitions/IT-1/seasons/1');
   await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
   await snapshotRequest;
   await page.waitForFunction(()=>document.querySelector('[data-match-detail]')?.dataset.matchLoad==='ready');
   assert.equal(matchCalls,0,engine+' rehydrating the server match must not issue a duplicate HTTP read');
   assert.equal(snapshotCalls,1,engine+' the rank/form snapshot remains a separate read');
   assert.deepEqual(catalogRequests,[],engine+' no global club/competition/division catalogs on initial match load');
   assert.deepEqual(await page.locator('[data-match-side-title]').allTextContents(),
    [officialClub('IT-1').primaryName,officialClub('IT-2').primaryName]);
   // Normal API fallback remains available for an undecorated HTML response.
   withBootstrap=false;
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('[data-match-detail]')?.dataset.matchLoad==='ready');
   assert.equal(matchCalls,1,engine+' missing bootstrap must fetch the public match once');
   assert.deepEqual(catalogRequests,[],engine+' fallback reads compact module, not large catalogs');
   // Search must still load the division catalogue on demand, once only.
   const divisionRequest=page.waitForRequest('**/data/divisions.json');
   await page.locator('#app-search-trigger').click();
   await divisionRequest;
   assert.equal(catalogRequests.filter(url=>url.endsWith('/data/divisions.json')).length,1,
    engine+' division search is lazy and single-flight');
  }finally{await ctx.close()}

  // A temporarily unavailable API must leave the paint-ready structure intact.
  {
   const ctx=await browser.newContext({viewport:{width:390,height:844}});
   try{
    const page=await ctx.newPage();
    await page.route('**/matches/123',route=>route.fulfill({status:200,
     contentType:'text/html',body:decorated}));
    await page.route('**/api/matches/123',route=>route.fulfill({status:503,
     contentType:'application/json',body:'{"error":{"code":"match_unavailable"}}'}));
    await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('[data-match-detail]')?.dataset.matchLoad==='unavailable');
    assert.equal(await page.locator('[data-match-feedback]').isVisible(),true);
    assert.deepEqual(await page.locator('[data-match-side-title]').allTextContents(),['','']);
    const boxes=await page.locator('.app-match-scoreboard,.app-match-side,.app-match-visual,[data-match-overview-panel],[data-match-pitch]')
     .evaluateAll(elements=>elements.map(el=>({display:getComputedStyle(el).display,
      visibility:getComputedStyle(el).visibility,
      width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
    assert.equal(boxes.length,6);
    assert.ok(boxes.every(b=>b.display!=='none'&&b.visibility==='visible'&&b.width>0&&b.height>0),
     JSON.stringify({engine,boxes}));
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
}
console.log('MATCH FIRST PAINT PASS: '+count+' Chromium/WebKit × Dark/Light × desktop/mobile direct-load+refresh cases, plus real controller score-state QA');
