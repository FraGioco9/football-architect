import {verifyCanonicalStateBrowser} from './canonical-state-browser.mjs';
import {chromium} from "playwright";
import {verifyFe04AccessibilityBrowser} from "./fe-04-accessibility-browser.mjs";
import {mkdirSync} from "node:fs";
import assert from "node:assert/strict";

// Match the canonical app origin used by generated <base> URLs and DEV modules.
const base="http://app.localhost:2000";
const out="int24-browser-artifacts";
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const widths=[1440,768,390,320];
const cups=["int-1","int-2"];
const views=["standings","postseason","fixtures","stats","history","rules","awards"];
const languages={en:"Standings",de:"Tabelle",es:"Clasificación",fr:"Classement",it:"Classifica"};
let checks=0;
let screenshots=0;
const screenshot=async(page,name)=>{
 await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})))});
 await page.screenshot({path:out+'/'+name,fullPage:true});screenshots++;
};
try {
 await verifyCanonicalStateBrowser(browser,'chromium');
 // Task 8: every canonical competition route initializes one shared, empty context.
 const allRoutes=["it","eng","es","de","fr","pt","nl","br"].flatMap(country=>[1,2].map(tier=>country+"-"+tier)).concat(cups);
 const routePage=await browser.newPage({viewport:{width:390,height:900}});
 try{
  for(const slug of allRoutes){
   const response=await routePage.goto(base+"/competitions/"+slug+"/stats",{waitUntil:"domcontentloaded"});
   assert.equal(response?.status(),200,"shared route "+slug);
   // Avoid unrelated background polling/network requests blocking the navigation gate.
   // Assert the actual competition context and statistics content instead.
   await routePage.waitForFunction(slug=>{
    const context=window.faCompetitionContext;
    return context?.definition?.id?.toLowerCase()===slug&&
     context.selectedSeason===1&&
     document.querySelectorAll('#fa-dev-stats .fa-dev-stats-card').length===3;
   },slug);
   await routePage.waitForSelector('#competition-tab-stats[aria-selected="true"]');
   const actual=await routePage.evaluate(()=>({
    id:window.faCompetitionContext?.definition?.id?.toLowerCase(),
    season:window.faCompetitionContext?.selectedSeason,
    tabs:document.querySelectorAll(".app-competition-tabs [role=tab]").length,
    stats:document.querySelectorAll("#fa-dev-stats .fa-dev-stats-card").length
   }));
   assert.deepEqual(actual,{id:slug,season:1,tabs:7,stats:3},"shared route "+slug);
   // SH-02: activate Standings once before snapshotting its hydrated
   // crest host. The first transition from Stats may still mount data;
   // later navigation must preserve the stable DOM identity.
   await routePage.locator("#competition-tab-standings").click();
   await routePage.waitForFunction(()=>{
    const active=document.querySelector("#competition-tab-standings[aria-selected='true']");
    const panel=document.querySelector("#competition-panel-standings");
    return !!active&&!!panel&&!panel.hidden;
   });
   await routePage.evaluate(()=>{
    window.__sh02Tabs=[...document.querySelectorAll(".app-competition-tabs [role=tab]")];
    window.__sh02Panels=window.__sh02Tabs.map(tab=>document.getElementById(tab.getAttribute("aria-controls")));
    window.__sh02Crest=document.querySelector("#app-standings-body [data-club-crest]");
   });
   for(const view of views){
    await routePage.locator("#competition-tab-"+view).click();
    const observed=await routePage.evaluate(view=>{
     const tab=document.getElementById("competition-tab-"+view);
     const panel=document.getElementById("competition-panel-"+view);
     const index=window.__sh02Tabs.indexOf(tab);
     return {route:window.faCompetitionRoute?.get()?.view,selected:tab?.getAttribute("aria-selected"),
      panelHidden:panel?.hidden,tabStable:index>=0,
      panelStable:index>=0&&window.__sh02Panels[index]===panel,
      crestStable:!window.__sh02Crest||window.__sh02Crest.isConnected&&
       document.querySelector("#app-standings-body [data-club-crest]")===window.__sh02Crest};
    },view);
    assert.deepEqual(observed,{route:view,selected:"true",panelHidden:false,tabStable:true,panelStable:true,crestStable:true},slug+"/"+view);
    assert.equal(await routePage.locator("#competition-panel-"+view).isVisible(),true,slug+"/"+view+" mounted view visible");
    checks++;
   }
  }
 }finally{await routePage.close()}

 // PAGE-LOAD-03B: independent cold pre-provider evidence for domestic P04/P05.
 for(const [slug,view,width,lang,season='1'] of [
  ['it-1','standings',320,'en'],['it-1','standings',390,'it'],
  ['it-1','standings',390,'it','2'],['it-2','fixtures',320,'en'],
  ['eng-1','fixtures',768,'de'],['de-1','standings',1440,'fr'],
  ['es-1','fixtures',390,'es']
 ]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(lang=>localStorage.setItem('football-architect:language',lang),lang);
  let release;const gate=new Promise(resolve=>release=resolve);
  const blocked=async route=>{await gate;try{await route.continue()}catch{}};
  await page.route('**/competitions/_shared/manifest.json',blocked);
  const route='/competitions/'+slug+'/'+view+'?season='+season+(view==='fixtures'?'&matchday=12':'');
  try{
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});
   assert.equal(response?.status(),200,route);
   await page.waitForFunction(()=>document.documentElement.dataset.faStandingsLoading==='true');
   const pending=await page.evaluate(view=>{
    const visible=n=>!!n&&!n.hidden&&n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).display!=='none';
    const header=document.querySelector('.app-competition-header'),tabs=document.querySelector('.app-competition-tabs');
    const panel=document.getElementById('competition-panel-'+view),season=document.getElementById('app-competition-season');
    window.__fa03bNodes={header,tabs,panel,season};
    return {
     header:visible(header),title:document.getElementById('division-detail-name')?.textContent?.trim(),
     tabs:tabs.querySelectorAll('[role=tab]').length,
     selected:[...tabs.querySelectorAll('[aria-selected="true"]')].map(n=>n.id),
     panel:visible(panel),season:!!season,
     rows:document.querySelectorAll('#app-standings-body tr[data-world-club]').length,
     fixtureSlots:document.querySelectorAll('#app-fixtures-skeleton [data-skeleton-fixture]').length,
     round:document.getElementById('app-fixtures-round-number')?.textContent?.trim(),
     falseEmpty:view==='fixtures'&&visible(document.getElementById('app-fixtures-empty')),
     visibleNames:[...document.querySelectorAll(innerWidth<=620?
      '.app-standings-skeleton .app-skeleton-mobile [data-skeleton-identity] .app-world-mobile-club-name':
      '.app-standings-skeleton [data-skeleton-row] [data-skeleton-identity] .app-world-club-name')].filter(visible).length,
     visiblePlaceholders:[...document.querySelectorAll(innerWidth<=620?
      '.app-standings-skeleton .app-skeleton-mobile [data-skeleton-mobile] .app-world-mobile-name.app-skeleton-bar':
      '.app-standings-skeleton [data-skeleton-row] > th .app-skeleton-bar')].filter(visible).length,
     staticIdentity:document.documentElement.dataset.faStandingsKnownIdentity,
     sportVisible:visible(document.querySelector('#competition-panel-standings > .app-world-standings #app-standings-body tr td:nth-child(10)')),
     firstNameLeft:(()=>{const n=document.querySelector(innerWidth<=620?
      '.app-standings-skeleton .app-skeleton-mobile [data-skeleton-mobile] .app-world-mobile-name.app-skeleton-bar':
      '.app-standings-skeleton [data-skeleton-row] > th .app-skeleton-bar');
      return n?n.getBoundingClientRect().left+(innerWidth<=620?47:55):null})(),
     firstNameWeight:(()=>{const n=document.querySelector(innerWidth<=620?
      '.app-standings-skeleton .app-skeleton-mobile [data-skeleton-identity] .app-world-mobile-club-name':
      '.app-standings-skeleton [data-skeleton-row] [data-skeleton-identity] .app-world-club-name');return n?getComputedStyle(n).fontWeight:null})(),
     crestProbe:(()=>{
      const host=document.querySelector('.app-standings-skeleton [data-club-crest-pending="true"]');
      if(!host)return null;
      const icon=host.querySelector('img.app-club-crest-image');
      return {src:icon?.getAttribute('src'),shield:getComputedStyle(host,'::before').display,visible:icon&&getComputedStyle(icon).visibility};
     })(),
     contextReady:!!window.faCompetitionContext,
     bodyVisible:getComputedStyle(document.body).visibility!=='hidden'
    };
   },view);
   assert.ok(pending.title,'static competition identity '+route);
   assert.equal(pending.header,true,'visible title header '+route);
   assert.equal(pending.bodyVisible,true,'visible body before manifest '+route);
   assert.equal(pending.tabs,7,'seven native tabs '+route);
   assert.deepEqual(pending.selected,['competition-tab-'+view],'correct active view '+route);
   assert.equal(pending.panel,true,'selected panel shown before manifest '+route);
   assert.equal(pending.season,true,'season control from first paint '+route);
   assert.equal(pending.rows,0,'no club identity row before manifest '+route);
   assert.equal(pending.fixtureSlots,8,'eight reserved fixture slots '+route);
   assert.equal(pending.contextReady,false,'manifest genuinely held '+route);
   if(view==='standings'){
    assert.equal(pending.staticIdentity,undefined,'no Season 1 identity fast-path before manifest '+route);
    assert.equal(pending.visibleNames,0,'ID-ordered identities must not paint before ranking '+route);
    assert.equal(pending.visiblePlaceholders,16,'16 neutral reserved club slots '+route);
    assert.equal(pending.sportVisible,false,'no premature sporting values '+route);
    assert.ok(pending.firstNameLeft>0,'reserve loaded club text X '+route);
    assert.equal(pending.crestProbe,null,'no club crest URL before manifest '+route);
   }
   if(view==='fixtures'){
    assert.equal(pending.round,'12','selected matchday at first paint '+route);
    assert.equal(pending.falseEmpty,false,'pending fixtures cannot show confirmed-empty '+route);
   }
   console.log('PAGE-LOAD-03B KNOWN-IDENTITY PREPAINT '+JSON.stringify({slug,view,width,lang,season,visibleNames:pending.visibleNames}));
   release();
   await page.waitForFunction(id=>window.faCompetitionContext?.definition?.id?.toLowerCase()===id&&!!window.faCompetitionRoute?.get,slug);
   const after=await page.evaluate(()=>({
    header:window.__fa03bNodes.header===document.querySelector('.app-competition-header'),
    tabs:window.__fa03bNodes.tabs===document.querySelector('.app-competition-tabs'),
    season:window.__fa03bNodes.season===document.getElementById('app-competition-season'),
    panel:window.__fa03bNodes.panel===document.getElementById('competition-panel-'+window.faCompetitionRoute.get().view)
   }));
   assert.deepEqual(after,{header:true,tabs:true,season:true,panel:true},'stable DOM after hydration '+route);
   if(view==='standings'&&season==='1'){
    await page.waitForFunction(()=>!!document.querySelector(innerWidth<=620?
      '#app-standings-compact-list .app-world-mobile-club-name':
      '#app-standings-body .app-world-club-name'));
    const loadedLeft=await page.evaluate(()=>{
     const n=document.querySelector(innerWidth<=620?
      '#app-standings-compact-list .app-world-mobile-club-name':
      '#app-standings-body .app-world-club-name');
     return n?.getBoundingClientRect().left??null;
    });
    assert.ok(loadedLeft!==null&&Math.abs(loadedLeft-pending.firstNameLeft)<=2,
      'neutral slot and loaded club name aligned within 2px '+route+
      ': first='+pending.firstNameLeft+', loaded='+loadedLeft);
    const loadedWeight=await page.evaluate(()=>{
     const n=document.querySelector(innerWidth<=620?
      '#app-standings-compact-list .app-world-mobile-club-name':
      '#app-standings-body .app-world-club-name');
     return n?getComputedStyle(n).fontWeight:null;
    });
    assert.equal(loadedWeight,'700','loaded team names remain bold '+route);
   }
   if(view==='standings'&&slug==='it-1'&&season==='1'&&width===390){
    // Public URL navigation can reject a future season when the QA world is in Season 1.
    // Exercise the same canonical coordinator transition without inventing availability.
    assert.equal(await page.evaluate(()=>window.faCompetitionContextApi.selectSeason(2)),true);
    await page.waitForFunction(()=>window.faCompetitionContext?.selectedSeason===2);
    await page.evaluate(()=>window.faStandingsLoading.set('page-load-03b-transition',true));
    const stale=await page.evaluate(()=>{
     const candidate=document.querySelector('.app-standings-skeleton .app-skeleton-mobile [data-skeleton-identity] .app-world-mobile-club-name');
     const shown=!!candidate&&candidate.getClientRects().length>0&&getComputedStyle(candidate).visibility!=='hidden';
     const results=document.querySelector('#competition-panel-standings>.app-world-standings');
     return {season:document.documentElement.dataset.faStandingsKnownIdentity,oldNameShown:shown,sportShown:getComputedStyle(results).visibility!=='hidden'};
    });
    assert.deepEqual(stale,{season:'false',oldNameShown:false,sportShown:false},'no Season 1 identity/sport leakage in Season 2 pending frame');
    await page.evaluate(()=>window.faStandingsLoading.set('page-load-03b-transition',false));
   }
   assert.deepEqual(errors,[],'no page exceptions '+route);
   checks++;
  }finally{release();await page.unroute('**/competitions/_shared/manifest.json',blocked);await page.close()}
 }

 // PAGE-LOAD-03C: cold Rules and deferred-view shells before the shared manifest.
 // These are focused P06-P13 subchecks, not complete six-axis acceptance.
 for(const [slug,view,width,lang] of [
  ['it-1','rules',390,'it'],['it-2','awards',320,'en'],
  ['de-1','stats',1440,'de'],['nl-2','history',390,'fr'],
  ['int-1','rules',768,'es'],['int-2','awards',390,'it'],
  ['int-1','history',320,'en']
 ]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(language=>localStorage.setItem('football-architect:language',language),lang);
  let release;const gate=new Promise(resolve=>release=resolve);
  const intercepted=async route=>{await gate;try{await route.continue()}catch{}};
  await page.route('**/competitions/_shared/manifest.json',intercepted);
  const path='/competitions/'+slug+'/'+view+'?season=1';
  try{
   const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});
   assert.equal(response?.status(),200,path);
   await page.waitForFunction(()=>document.documentElement.dataset.faStandingsLoading==='true');
   const initial=await page.evaluate(view=>{
    const visible=node=>!!node&&!node.hidden&&node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden'&&getComputedStyle(node).display!=='none';
    const header=document.querySelector('.app-competition-header'),tabs=document.querySelector('.app-competition-tabs');
    const season=document.getElementById('app-competition-season'),panel=document.getElementById('competition-panel-'+view);
    window.__fa03cNodes={header,tabs,season,panel};
    const shell=panel?.querySelector('[data-competition-skeleton-root]'),rules=panel?.querySelector('.app-rules-content');
    return {title:document.getElementById('division-detail-name')?.textContent?.trim(),
      header:visible(header),tabs:tabs?.querySelectorAll('[role=tab]').length,
      active:[...tabs.querySelectorAll('[aria-selected="true"]')].map(n=>n.id),
      panel:visible(panel),season:!!season,context:!!window.faCompetitionContext,
      rules:!!rules&&rules.querySelectorAll('.app-rules-section').length>0,
      skeleton:!!shell&&visible(shell)&&shell.querySelectorAll('.app-skeleton-bar').length>0,
      route:document.documentElement.dataset.competitionView===view};
   },view);
   assert.ok(initial.title,'known competition title before manifest '+path);
   assert.equal(initial.header,true,'static header '+path);
   assert.equal(initial.tabs,7,'seven native tabs '+path);
   assert.deepEqual(initial.active,['competition-tab-'+view],'correct parser-time selection '+path);
   assert.equal(initial.panel,true,'visible selected panel '+path);
   assert.equal(initial.season,true,'permanent season selector '+path);
   assert.equal(initial.context,false,'manifest truly intercepted '+path);
   assert.equal(initial.route,true,'route view set before provider '+path);
   if(view==='rules')assert.equal(initial.rules,true,'full static Rules before manifest '+path);
   else assert.equal(initial.skeleton,true,'reserved layout instead of blank view '+path);
   release();
   await page.waitForFunction(slug=>window.faCompetitionContext?.definition?.id?.toLowerCase()===slug&&!!window.faCompetitionRoute?.get,slug);
   const hydrated=await page.evaluate(view=>({
    header:window.__fa03cNodes.header===document.querySelector('.app-competition-header'),
    tabs:window.__fa03cNodes.tabs===document.querySelector('.app-competition-tabs'),
    season:window.__fa03cNodes.season===document.getElementById('app-competition-season'),
    panel:window.__fa03cNodes.panel===document.getElementById('competition-panel-'+view),
    selected:document.getElementById('competition-tab-'+view)?.getAttribute('aria-selected'),
    rules:view!=='rules'||document.querySelector('#competition-panel-rules [data-rule-definition]')!==null
   }),view);
   assert.deepEqual(hydrated,{header:true,tabs:true,season:true,panel:true,selected:'true',rules:true},'permanent DOM survives hydration '+path);
   assert.deepEqual(errors,[],'no first-paint exceptions '+path);
   console.log('PAGE-LOAD-03C PREPAINT '+JSON.stringify({slug,view,width,lang,fullStaticRules:initial.rules,reservedView:initial.skeleton}));
   checks++;
  }finally{release();await page.unroute('**/competitions/_shared/manifest.json',intercepted);await page.close()}
 }
 // PAGE-LOAD-03C2: synchronous Season 1 -> Season 2 source invalidation.
 // A transition must preserve the static shell and must not show old-season
 // Stats, History or Awards while the new season has no confirmed source.
 for(const [slug,view,width,lang] of [
  ['it-1','stats',390,'it'],
  ['it-2','history',1440,'en'],
  ['int-1','awards',320,'de']
 ]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(language=>localStorage.setItem('football-architect:language',language),lang);
  const path='/competitions/'+slug+'/'+view+'?season=1';
  try{
   const response=await page.goto(base+path,{waitUntil:"domcontentloaded"});
   assert.equal(response?.status(),200,path);
   await page.waitForFunction(id=>window.faCompetitionContext?.definition?.id?.toLowerCase()===id&&
    !!window.faCompetitionContextApi?.selectSeason,slug);
   // Wait for semantic Stats/Awards state after initial hydration, not network idle.
   if(view==='stats'||view==='awards')await page.waitForFunction(view=>
    !!document.getElementById('competition-panel-'+view)?.dataset.faContentState,view);
   const state=await page.evaluate(view=>{
    const header=document.querySelector('.app-competition-header');
    const tabs=document.querySelector('.app-competition-tabs');
    const seasonControl=document.getElementById('app-competition-season');
    const panel=document.getElementById('competition-panel-'+view);
    const before=window.faCompetitionContext;
    const accepted=window.faCompetitionContextApi.selectSeason(2);
    const after=window.faCompetitionContext;
    return {accepted,season:after?.selectedSeason,revisionAdvanced:after?.revision>before.revision,
     data:after?.seasonData??null,
     headerStable:header===document.querySelector('.app-competition-header'),
     tabsStable:tabs===document.querySelector('.app-competition-tabs'),
     controlStable:seasonControl===document.getElementById('app-competition-season'),
     panelStable:panel===document.getElementById('competition-panel-'+view),
     selected:document.getElementById('competition-tab-'+view)?.getAttribute('aria-selected'),
     statsState:view==='stats'?panel.dataset.faContentState:null,
     statsValues:view==='stats'?panel.querySelectorAll('#fa-dev-stats .app-competition-stat-value').length:null,
     awardsState:view==='awards'?panel.dataset.faContentState:null,
     oldAwards:view==='awards'?[...panel.querySelectorAll('.fa-awards-card[data-award-status="available"]')].length:null,
     authoritativeHistory:view==='history'?!!panel.querySelector('[data-authoritative-history]:not([hidden])'):null};
   },view);
   assert.equal(state.accepted,true,'canonical season transition accepted '+path);
   assert.equal(state.season,2,'new selected season '+path);
   assert.equal(state.revisionAdvanced,true,'source revision advanced '+path);
   assert.equal(state.data,null,'new season starts without stale data '+path);
   for(const key of ['headerStable','tabsStable','controlStable','panelStable'])assert.equal(state[key],true,key+' '+path);
   assert.equal(state.selected,'true','active view remains selected '+path);
   if(view==='stats'){
    assert.equal(state.statsState,'unknown','unresolved Stats are not confirmed empty '+path);
    assert.equal(state.statsValues,0,'prior stats values removed '+path);
   }
   if(view==='awards'){
    assert.equal(state.awardsState,'unknown','unresolved Awards not confirmed empty '+path);
    assert.equal(state.oldAwards,0,'no old season award recipient '+path);
   }
   if(view==='history')assert.equal(state.authoritativeHistory,false,'no prior authoritative History '+path);
   assert.deepEqual(errors,[],'no transition errors '+path);
   console.log('PAGE-LOAD-03C2 SOURCE TRANSITION '+JSON.stringify({slug,view,width,lang,season:state.season}));
   checks++;
  }finally{await page.close()}
 }

 // Confirmed failure may show a localized error, not destroy Rules or tabs.
 for(const view of ['rules','history']){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  const failure=route=>route.fulfill({status:503,contentType:'application/json',body:'{}'});
  await page.route('**/competitions/_shared/manifest.json',failure);
  const path='/competitions/it-1/'+view+'?season=1';
  try{
   await page.goto(base+path,{waitUntil:'domcontentloaded'});
   await page.locator('[data-competition-load-error] [role=alert]').waitFor();
   assert.equal(await page.locator('.app-competition-tabs [role=tab]').count(),7,'failed manifest retains seven tabs '+path);
   assert.equal(await page.locator('#competition-tab-'+view).getAttribute('aria-selected'),'true','failed manifest retains active tab '+path);
   assert.equal(await page.locator('#competition-panel-'+view).count(),1,'failed manifest retains selected panel '+path);
   if(view==='rules')assert.ok(await page.locator('#competition-panel-rules [data-rule-definition]').count()>0,'canonical Rules survive manifest failure');
   await page.unroute('**/competitions/_shared/manifest.json',failure);
   await page.reload({waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>window.faCompetitionContext?.definition?.id==='IT-1');
   assert.equal(await page.locator('[data-competition-load-error]').count(),0,'hard refresh recovers '+path);
   checks++;
  }finally{await page.unroute('**/competitions/_shared/manifest.json',failure);await page.close()}
 }

 // Manifest 503 and invalid JSON must retain permanent identity/navigation and
 // display an honest confirmed error; a hard refresh with a valid manifest recovers.
 for(const [kind,status,body] of [['503',503,'{}'],['invalid-json',200,'invalid json']]){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  const broken=route=>route.fulfill({status,contentType:'application/json',body});
  await page.route('**/competitions/_shared/manifest.json',broken);
  try{
   await page.goto(base+'/competitions/it-1/fixtures?season=1&matchday=12',{waitUntil:"domcontentloaded"});
   await page.locator('[data-competition-load-error] [role=alert]').waitFor();
   const state=await page.evaluate(()=>({
    shell:!!document.getElementById('app-divisions'),
    title:!!document.getElementById('division-detail-name')?.textContent?.trim(),
    tabs:document.querySelectorAll('.app-competition-tabs [role=tab]').length,
    rows:document.querySelectorAll('#app-standings-body tr[data-world-club]').length,
    falseEmpty:!document.getElementById('app-fixtures-empty')?.hidden
   }));
   assert.deepEqual(state,{shell:true,title:true,tabs:7,rows:0,falseEmpty:false},'confirmed failure leaves anonymous standings until catalog recovers: '+kind);
   await page.unroute('**/competitions/_shared/manifest.json',broken);
   await page.reload({waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>window.faCompetitionContext?.definition?.id==='IT-1');
   assert.equal(await page.locator('[data-competition-load-error]').count(),0,'recover on hard refresh '+kind);
   checks++;
  }finally{await page.unroute('**/competitions/_shared/manifest.json',broken);await page.close()}
 }
 const firstPaint=await browser.newPage({viewport:{width:1440,height:900}});
 await firstPaint.route('**/assets/competition-page.js',route=>route.abort());
 await firstPaint.goto(base+'/competitions/int-1/postseason',{waitUntil:'domcontentloaded'});
 assert.equal(await firstPaint.evaluate(()=>Boolean(window.faCompetitionContext)),false);
 assert.ok(await firstPaint.locator('#competition-panel-postseason').isVisible());
 assert.ok(await firstPaint.locator('.fa-bracket-links:visible').count()>0);
 assert.ok(await firstPaint.locator('[data-postseason-config-slot]').evaluateAll(nodes=>nodes.length===22&&nodes.every(node=>{
  const crest=getComputedStyle(node,'::before'),name=getComputedStyle(node,'::after');
  return crest.width==='28px'&&crest.height==='28px'&&name.width==='112px'&&name.height==='13px';
 })),
  'First paint reserves the club crest and name');
 const misplacedLinks=await firstPaint.locator('.fa-bracket-links:visible [data-bracket-link]').evaluateAll(paths=>paths.filter(path=>{
  const [sourceId,targetId]=path.dataset.bracketLink.split(':');
  const source=document.querySelector('[data-bracket-tie="'+sourceId+'"]').getBoundingClientRect();
  const target=document.querySelector('[data-bracket-tie="'+targetId+'"]').getBoundingClientRect();
  const origin=path.ownerSVGElement.getBoundingClientRect();
  const start=path.getPointAtLength(0),end=path.getPointAtLength(path.getTotalLength());
  return Math.abs(origin.left+start.x-source.right)>1||Math.abs(origin.top+start.y-source.top-source.height/2)>1||
    Math.abs(origin.left+end.x-target.left)>1||Math.abs(origin.top+end.y-target.top-target.height/2)>1;
 }).map(path=>path.dataset.bracketLink));
 assert.deepEqual(misplacedLinks,[],'Static links touch the center edges of the correct cards');
 for(const width of [320,390,620,768,1440]){
  await firstPaint.setViewportSize({width,height:900});
  const connectors=await firstPaint.evaluate(()=>{
   const cards=new Map([...document.querySelectorAll('[data-bracket-tie]')].map(node=>[node.dataset.bracketTie,node]));
   const all=[...document.querySelectorAll('[data-bracket-link]')];
   const visible=all.filter(path=>getComputedStyle(path.ownerSVGElement).display!=='none');
   const expected=[...new Set(all.map(path=>path.dataset.bracketLink))].filter(link=>{
    const [source,target]=link.split(':');
    const a=cards.get(source)?.closest('.fa-bracket-round')?.getBoundingClientRect();
    const b=cards.get(target)?.closest('.fa-bracket-round')?.getBoundingClientRect();
    return a&&b&&Math.abs(a.top-b.top)<=1&&b.left>a.left;
   });
   const missing=expected.filter(link=>!visible.some(path=>path.dataset.bracketLink===link));
   const unexpected=visible.filter(path=>!expected.includes(path.dataset.bracketLink)).map(path=>path.dataset.bracketLink);
   const misplaced=visible.filter(path=>{
    const [sourceId,targetId]=path.dataset.bracketLink.split(':');
    const source=cards.get(sourceId).getBoundingClientRect();
    const target=cards.get(targetId).getBoundingClientRect();
    const origin=path.ownerSVGElement.getBoundingClientRect();
    const start=path.getPointAtLength(0),end=path.getPointAtLength(path.getTotalLength());
    return Math.abs(origin.left+start.x-source.right)>1||Math.abs(origin.top+start.y-source.top-source.height/2)>1||
      Math.abs(origin.left+end.x-target.left)>1||Math.abs(origin.top+end.y-target.top-target.height/2)>1;
   }).map(path=>path.dataset.bracketLink);
   return {total:visible.length,expected:expected.length,missing,unexpected,misplaced};
  });
  assert.deepEqual(connectors,{total:width<=620?0:width===1440?10:6,
   expected:width<=620?0:width===1440?10:6,missing:[],unexpected:[],misplaced:[]},
   'First-paint connections match exactly the same-row round pairs at '+width+'px');
 }
 await firstPaint.close();
 for(const cup of cups)for(const width of widths){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  for(const view of views){
   const url=base+"/competitions/"+cup+"/"+view;
   const response=await page.goto(url,{waitUntil:"domcontentloaded"});
   assert.equal(response?.status(),200,url);
   await page.waitForSelector('#competition-tab-'+view+'[aria-selected="true"]');
   await page.waitForFunction(id=>window.faCompetitionContext?.definition?.id===id&&
    window.faCompetitionContext?.selectedSeason===1,cup);
   // DOMContentLoaded exposes the permanent tabs before each view's dynamic
   // content is ready. Confirm the view's own semantic state, not network idle.
   await page.waitForFunction(view=>{
    const panel=document.getElementById('competition-panel-'+view);
    if(!panel||panel.hidden)return false;
    if(view==='fixtures'){
     const toolbar=document.getElementById('app-fixtures-toolbar');
     return !!panel.dataset.faContentState&&!!toolbar&&!toolbar.getClientRects().length;
    }
    if(view==='stats')return panel.querySelectorAll('.fa-dev-stats-card').length===3;
    if(view==='awards')return document.querySelectorAll('#competition-panel-awards > .fa-awards .fa-awards-card').length===11;
    if(view==='postseason')return panel.querySelectorAll('[data-bracket-tie]').length===11;
    return true;
   },view);
   const visible=await page.locator("#competition-panel-"+view).isVisible();
   if(!visible){
    const probe=await page.evaluate(view=>({
     url:location.href,view,route:window.faCompetitionRoute?.get?.(),
     context:window.faCompetitionContext?.definition?.id,
     season:window.faCompetitionContext?.selectedSeason,
     panelHidden:document.getElementById('competition-panel-'+view)?.hidden,
     panelDisplay:getComputedStyle(document.getElementById('competition-panel-'+view)).display,
     bodyVisibility:getComputedStyle(document.body).visibility,
     prepaint:document.documentElement.dataset.faCompetitionPrepaint,
     seasonUnavailable:document.documentElement.dataset.competitionSeasonUnavailable,
     loading:document.documentElement.dataset.faStandingsLoading,
     bootstrap:!!window.faCompetitionContextApi,domCore:!!window.faCompetitionRenderDOM
    }),view);
    throw new Error('Competition panel invisible: '+JSON.stringify(probe)+' pageerrors='+JSON.stringify(errors));
   }
   assert.equal(await page.locator(".app-competition-header").count(),1);
   assert.equal(await page.locator("#division-detail-name").innerText(),cup==="int-1"?"Sovereign Cup":"Federation Cup");
   assert.equal(await page.locator(".app-competition-tabs [role=tab]").count(),7);
   assert.equal(await page.locator("#app-competition-season").isVisible(),true);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
   assert.equal(overflow,false,"horizontal overflow "+cup+" "+width+" "+view);
   const context=await page.evaluate(()=>({id:window.faCompetitionContext?.definition.id,season:window.faCompetitionContext?.selectedSeason,data:window.faCompetitionContext?.seasonData,domestic:!!window.faCompetitionDivision,frozen:Object.isFrozen(window.faCompetitionContext?.definition.rules)}));
   assert.deepEqual(context,{id:cup,season:1,data:null,domestic:false,frozen:true});
   if(view==="rules"){
    assert.equal(await page.locator('[data-rule-metric="league.matches"]').innerText(),'72');
    assert.equal(await page.locator('[data-rule-metric="totalMatches"]').innerText(),'93');
    assert.equal(await page.locator('[data-rule-kind="relegated"]').count(),0);
    assert.equal(await page.locator('[data-rule-kind="promoted"]').count(),0);
   }
   if(view==="awards"){
    assert.equal(await page.locator('#competition-panel-awards > .fa-awards .fa-awards-card').count(),11,
      'Rendered awards must be mounted directly, never trapped in the aria-hidden skeleton');
    assert.equal(await page.locator('#competition-panel-awards .fa-awards-card').count(),11,
      'Only the 11 live awards cards may remain inside the mounted Awards panel');
    assert.equal(await page.locator('#competition-panel-awards [data-competition-skeleton-root]').count(),0,
      'The mounted Awards panel must discard its first-paint skeleton');
    assert.equal(await page.locator('.fa-awards-card-promotion,.fa-awards-card-playoff').count(),0);
    assert.equal(await page.locator('[data-award-status="available"]').count(),0);
   }
   if(view==='fixtures'){
    assert.equal(await page.locator('[data-fixture-round-choice]').count(),10); // 6 league rounds + 4 knockout phases; legs share one selector
    assert.equal(await page.locator('[data-fixture-round-choice="30"]').count(),0);
    assert.equal(await page.locator('#app-fixtures-toolbar').isVisible(),false);
   }
   if(view==='postseason'){
    assert.equal(await page.locator('[data-postseason-config-tie]').count(),11);
    const cards=page.locator('[data-bracket-tie]');
    assert.equal(await cards.count(),11);
    assert.equal(await page.locator('[data-postseason-help],[data-postseason-filter],[data-postseason-outcome]').count(),0);
    const cardLayout=await cards.evaluateAll(nodes=>nodes.map(card=>({
     id:card.dataset.bracketTie,width:card.offsetWidth,height:card.offsetHeight,rows:card.children.length,
     scores:card.querySelectorAll('[data-postseason-score]').length
    })));
    const geometry=await page.locator('.fa-bracket-board').evaluate(board=>{
     const rounds=[...board.querySelectorAll('.fa-bracket-round')].map(node=>node.getBoundingClientRect());
     return {trackWidths:rounds.map(rect=>rect.width),
      columnCount:new Set(rounds.map(rect=>Math.round(rect.left))).size};
    });
    const expectedColumns=width<=390?1:width===768?2:4;
    assert.equal(geometry.columnCount,expectedColumns,'responsive columns '+cup+' '+width);
    for(const {id,...card} of cardLayout)assert.deepEqual(card,{
     width:Math.round(geometry.trackWidths[0]),height:120,rows:2,scores:id==='final'?2:4
    },cup+' '+width+'px '+id+' fluid card geometry and scores');
    if(width===1440)assert.notEqual(geometry.trackWidths[0],320,'desktop cards adapt to available width');
    if(expectedColumns>1)assert.ok(geometry.trackWidths.every(cardWidth=>cardWidth>=260),
      'multi-column cards keep at least 260px for crest, name and scores at '+width+'px');
    const links=page.locator('.fa-bracket-links:visible [data-bracket-link]');
    assert.equal(await links.count(),width<=390?0:width===1440?10:6,'Only same-row connections visible');
    // Postseason shell mounts before the asynchronous API source finishes.
    // Preserve the first-paint skeleton but assert its release only after loading settles.
    await page.waitForFunction(()=>document.documentElement.dataset.faStandingsLoading==='false',null,{timeout:10000});
    assert.equal(await page.locator('[data-postseason-config-slot]').first().evaluate(node=>getComputedStyle(node,'::before').content),'none','Unassigned slots become readable when loading settles');
    if(width===1440||width===768)assert.ok(await links.count()>0,'Adjacent rounds show connectors');
    if(width<=390)assert.equal(await links.count(),0,'Single-column rounds have no connector');
    const rounds=page.locator('[data-postseason-round]:visible');
    assert.deepEqual(await rounds.evaluateAll(nodes=>nodes.map(node=>node.dataset.postseasonRound)),['playoffs','quarterfinals','semifinals','final']);
    const columns=await rounds.evaluateAll(nodes=>nodes.map(node=>{
      const box=node.getBoundingClientRect();
      return {left:box.left,top:box.top,width:box.width};
    }));
    if(width===1440)assert.ok(columns.every((column,i)=>i===0||column.left>columns[i-1].left&&Math.abs(column.top-columns[0].top)<=1),'Desktop displays one column per round');
    if(width<=390)assert.ok(columns.every(column=>Math.abs(column.left-columns[0].left)<=1),'Small screens stack all rounds');
    if(width===768)assert.ok(Math.abs(columns[0].top-columns[1].top)<=1&&columns[2].top>columns[0].top&&Math.abs(columns[0].left-columns[2].left)<=1,'Two columns preserve round order at '+width);
    const brokenRanks=await page.locator('[data-postseason-position] strong').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().height>parseFloat(getComputedStyle(node).lineHeight)*1.2).map(node=>node.textContent));
    assert.deepEqual(brokenRanks,[],'seed rank digits must stay on one line at '+width+'px');
   }
   if(view==='stats'){
    await page.waitForFunction(()=>Boolean(window.faCompetitionStats));
    assert.equal(await page.locator('#fa-dev-stats .fa-dev-stats-card').count(),3);
    assert.equal(await page.locator('#fa-dev-stats .app-competition-stat-value').count(),0);
    await page.locator('[data-stats-view="teams"]').click();
    assert.equal(await page.locator('.fa-dev-stats-team-card').count(),7);
    assert.equal(await page.locator('.fa-dev-stats-expand').count(),0);
    await page.locator('[data-stats-view="players"]').click();
    assert.equal(await page.locator('.fa-dev-stats-leader-card').count(),4);
    await screenshot(page,cup+'-'+width+'-empty-stats.png');
    await page.locator('[data-stats-view="players"]').focus();await page.keyboard.press('Home');
    assert.equal(await page.locator('[data-stats-view="overview"]').evaluate(el=>document.activeElement===el),true);
    assert.equal(await page.locator('.fa-dev-stats-card').count(),3);
    checks++;
   }
   checks++;
  }
  await page.goto(base+"/competitions/"+cup,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(id=>window.faCompetitionContext?.definition?.id===id,cup);
  await page.waitForFunction(()=>Boolean(window.faCompetitionStats)&&
   document.querySelectorAll('#fa-dev-stats [data-stats-view]').length===3);
  for(const [lang,label] of Object.entries(languages)){
   await page.evaluate(lang=>{document.documentElement.lang=lang},lang);
   await page.waitForFunction(expected=>document.querySelector("#competition-tab-standings")?.textContent===expected,label);
   const headings={en:"Competition format",de:"Wettbewerbsformat",es:"Formato de competición",fr:"Format de la compétition",it:"Formula della competizione"};
   await page.waitForFunction(expected=>document.querySelector('#rules-format')?.textContent===expected,headings[lang]);
   assert.equal(await page.locator('[data-rule-metric="league.matches"]').textContent(),'72');
   const statsLabels={en:['Overview','Teams','Players'],de:['Übersicht','Teams','Spieler'],es:['Resumen','Equipos','Jugadores'],fr:['Vue d’ensemble','Équipes','Joueurs'],it:['Panoramica','Squadre','Giocatori']};
   assert.deepEqual(await page.locator('#fa-dev-stats [data-stats-view]').allTextContents(),statsLabels[lang]);
   checks++;
  }
  for(const theme of ["dark","light"]){
   await page.evaluate(value=>localStorage.setItem("football-architect:theme",value),theme);
   await page.reload({waitUntil:"domcontentloaded"});
   assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
   await page.waitForFunction(id=>window.faCompetitionContext?.definition?.id===id,cup);
   await page.locator('#competition-tab-postseason').click();
   await page.waitForFunction(()=>document.querySelectorAll('#competition-panel-postseason [data-bracket-tie]').length===11);
   await screenshot(page,cup+"-"+width+"-"+theme+".png");
   checks++;
  }
  // Only this test supplies fictional cup data; the public/runtime code never generates it.
  await page.evaluate(()=>{
   const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
   const participants=Array.from({length:24},(_,i)=>({countryId:countries[Math.floor(i/3)],clubId:i%3+1,primaryName:'QA Club '+(i+1),abbr:'Q'+(i+1)}));
   const id=i=>participants[i].countryId+'-'+participants[i].clubId;
   const fixtures=Array.from({length:12},(_,i)=>({phaseId:'league',round:1,homeId:id(i),awayId:id(i+12),homeGoals:null,awayGoals:null,kickoff:null}));
   const standings=participants.map(club=>({club,played:6,won:2,drawn:2,lost:2,gf:5,ga:5,gd:0,pts:8,recent:[]}));
   const teams=participants.map(club=>({clubKey:club.countryId+'-'+club.clubId,clubName:club.primaryName,mp:6,gf:5,ga:5,w:2,cs:1,ppg:8/6,gd:0,unbeatenStreak:2}));
   const data={season:1,rulesVersion:window.faCompetitionContext.definition.rules.version,participants,fixtures,results:[{id:'p89',winnerId:id(8)},{id:'q1',winnerId:id(0),legs:[{homeId:id(8),awayId:id(0),homeGoals:1,awayGoals:0},{homeId:id(0),awayId:id(8),homeGoals:2,awayGoals:0,afterExtraTime:true}]}],statistics:{standings,overview:{matchesPlayed:12,totalGoals:36,goalsPerMatch:3},teams,players:[]},status:'partial'};
   if(!window.faCompetitionContextApi.replaceSeasonData(data,window.faCompetitionContext.revision))throw Error('QA supplied data rejected');
  });
  assert.equal(await page.locator('#app-standings-body tr').count(),24);
  assert.equal(await page.locator('[data-postseason-config-slot="q1:0"]').innerText(),'QA Club 1');
  assert.equal(await page.locator('[data-postseason-config-slot="q1:1"]').innerText(),'QA Club 9');
  assert.equal(await page.locator('[data-postseason-score="q1:0:first"]').innerText(),'0');
  assert.equal(await page.locator('[data-postseason-score="q1:0:second"]').innerText(),'2');
  assert.equal(await page.locator('[data-postseason-score="q1:1:first"]').innerText(),'1');
  assert.equal(await page.locator('[data-postseason-score="q1:1:second"]').innerText(),'0');
  assert.ok(await page.locator('[data-postseason-resolution="q1"]').isVisible());
  const alignment=await page.locator('[data-bracket-tie="q1"]').evaluate(card=>{
   const end=selector=>card.querySelector(selector).getBoundingClientRect().right;
   const first=end('[data-postseason-score="q1:0:first"]');
   const second=end('[data-postseason-score="q1:0:second"]');
   const note=card.nextElementSibling.getBoundingClientRect().right;
   return {gap:second-first,inset:card.getBoundingClientRect().right-second,noteOffset:note-second};
  });
  assert.deepEqual(alignment,{gap:22,inset:18,noteOffset:0},'Scores and resolution share the right edge');
  await screenshot(page,cup+'-'+width+'-supplied-knockouts.png');
  await page.locator('#competition-tab-stats').click();
  await page.locator('[data-stats-view="overview"]').click();
  assert.deepEqual(await page.locator('#competition-panel-stats .app-competition-stat-value').allTextContents(),['12','36','3.00']);
  await page.locator('[data-stats-view="overview"]').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.fa-dev-stats-team-card').count(),7);
  assert.equal(await page.locator('.fa-dev-stats-expand').count(),7);
  await screenshot(page,cup+'-'+width+'-supplied-stats-teams.png');
  const expand=page.locator('.fa-dev-stats-expand').first();
  await expand.focus();await page.keyboard.press('Enter');
  await page.waitForSelector('dialog.fa-dev-stats-dialog[open]');
  assert.equal(await page.locator('dialog .fa-dev-stats-top>li').count(),24);
  assert.equal(await page.locator('dialog .fa-dev-stats-rank').evaluateAll(nodes=>nodes.every(node=>node.textContent==='1')),true);
  await screenshot(page,cup+'-'+width+'-stats-dialog.png');
  await page.keyboard.press('Escape');await page.waitForSelector('dialog.fa-dev-stats-dialog',{state:'detached'});
  assert.equal(await expand.evaluate(el=>document.activeElement===el),true);
  await expand.click();await page.waitForSelector('dialog[open]');await page.mouse.click(2,2);
  await page.waitForSelector('dialog.fa-dev-stats-dialog',{state:'detached'});
  await expand.click();await page.locator('.fa-dev-stats-dialog-close').click();
  await page.waitForSelector('dialog.fa-dev-stats-dialog',{state:'detached'});
  checks+=3;
  await page.evaluate(()=>window.faCompetitionRoute.set({view:'fixtures',matchday:1}));
  assert.equal(await page.locator('#app-fixtures-list [data-fixture-match]').count(),12);
  const revision=await page.evaluate(()=>window.faCompetitionContext.revision);
  await page.evaluate(()=>window.faCompetitionRoute.set({matchday:'quarterfinals:2'}));
  assert.equal(await page.evaluate(()=>window.faCompetitionContext.revision),revision,'fixture browsing must not change simulation/data progress');
  assert.equal(await page.locator('#app-fixtures-list [data-fixture-match]').count(),0);
  await page.evaluate(()=>window.faCompetitionContextApi.clearSeasonData());
  assert.equal(await page.locator('#app-standings-body tr').count(),1);
  assert.equal(await page.locator('#app-fixtures-toolbar').isVisible(),false);
  checks+=3;
  const tabs=page.locator(".app-competition-tabs [role=tab]");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForURL("**/postseason?season=1");
  assert.equal(await tabs.nth(1).evaluate(el=>document.activeElement===el),true);
  await page.keyboard.press("End");
  await page.waitForURL("**/awards?season=1");
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#competition-panel-awards").waitFor({state:"visible"});
  await page.goBack({waitUntil:"domcontentloaded"});
  await page.locator("#competition-panel-postseason").waitFor({state:"visible"});
  checks++;
  assert.deepEqual(errors,[],"JS errors "+cup+" "+width);
  await page.close();
 }
 // Season 0 is a DEV-only inactive state shared by cups, domestic divisions,
 // Calendar and Club; it never creates a simulated season 0.
 const page=await browser.newPage({viewport:{width:390,height:900}});
 const zeroErrors=[];page.on("pageerror",error=>zeroErrors.push(error.message));
 page.on("console",message=>{if(message.type()==="error")console.log("DEV browser console: "+message.text())});
 page.on("response",response=>{if(response.status()>=400)console.log("DEV HTTP "+response.status()+" "+response.url())});
 for(const route of ["/competitions/int-1/standings","/competitions/int-2/fixtures","/competitions/int-1/stats","/competitions/it-1/standings","/competitions/it-1/stats","/calendar","/clubs/it/1/overview"]){
  console.log("Season 0 QA route: "+route);
  await page.goto(base+route,{waitUntil:"domcontentloaded"});
  try{await page.waitForSelector('.fa-dev-widget-button')}catch(error){console.log("DEV state: "+JSON.stringify(await page.evaluate(()=>({url:location.href,dataset:{...document.documentElement.dataset},widgets:document.querySelectorAll('.fa-dev-widget').length}))));console.log("DEV JS errors: "+JSON.stringify(zeroErrors));throw error}
  await page.locator('.fa-dev-widget-button').click();
  const season=page.locator('[data-dev-control="season-number"]');
  assert.equal(await season.getAttribute('min'),'0');
  await season.fill('0');await season.dispatchEvent('change');
  await page.waitForFunction(()=>document.querySelector('[data-dev-control="world-day"]')?.disabled===true);
  assert.equal(await page.locator('[data-dev-control="world-day-number"]').isDisabled(),true);
  assert.equal(await page.locator('[data-dev-control-row="world-day"] button:disabled').count(),2);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('football-architect:standings-dev-season')),'0');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('football-architect:standings-dev-matchdays')),'0');
  if(route.startsWith('/competitions/')){
   assert.equal(await page.locator('#app-competition-season').isDisabled(),false);
   assert.equal(await page.locator('#app-competition-season-value').innerText(),'1');
   assert.equal(await page.locator('#app-competition-season-unavailable').isVisible(),false);
   assert.equal(await page.locator('#competition-panel-'+route.split('/').at(-1)).isVisible(),true);
   assert.equal(await page.evaluate(()=>window.faCompetitionRoute.get().season),'1');
   assert.deepEqual(await page.evaluate(()=>({season:window.faCompetitionContext?.selectedSeason,data:window.faCompetitionContext?.seasonData})),{season:1,data:null});
   if(route.endsWith('/stats')){assert.equal(await page.locator('#fa-dev-stats .fa-dev-stats-card').count(),3);assert.equal(await page.locator('#fa-dev-stats .app-competition-stat-value').count(),0)}
  }
  if(route==='/calendar'){
   assert.equal(await page.locator('#calendar-season-picker').isDisabled(),false);
   assert.equal(await page.locator('#calendar-season-value').innerText(),'1');
  }
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForSelector('.fa-dev-widget-button');
  assert.equal(await page.locator('[data-dev-control="world-day"]').isDisabled(),true);
  if(route.startsWith('/competitions/')){
   assert.equal(await page.locator('#app-competition-season-value').innerText(),'1');
   assert.equal(await page.locator('#app-competition-season-unavailable').isVisible(),false);
   assert.equal(await page.locator('#competition-panel-'+route.split('/').at(-1)).isVisible(),true);
   if(route.endsWith('/stats'))assert.equal(await page.locator('#fa-dev-stats .app-competition-stat-value').count(),0);
   await page.locator('#app-competition-season').click();
   assert.deepEqual(await page.locator('#app-competition-season-menu [role=option]').allTextContents(),['1']);
   await page.locator('#app-competition-season').click();
  }
  if(route==='/calendar'){
   assert.equal(await page.locator('#calendar-season-value').innerText(),'1');
   await page.locator('#calendar-season-picker').click();
   assert.deepEqual(await page.locator('#calendar-season-menu [role=option]').allTextContents(),['1']);
   await page.locator('#calendar-season-picker').click();
  }
  await page.locator('.fa-dev-widget-button').click();
  await page.locator('[data-dev-control="season-number"]').fill('1');
  await page.locator('[data-dev-control="season-number"]').dispatchEvent('change');
  await page.waitForFunction(()=>document.querySelector('[data-dev-control="world-day"]')?.disabled===false&&window.faDevWorldClockSnapshot?.current?.season===1);
  assert.equal(await page.evaluate(()=>window.faDevWorldClockSnapshot?.current?.season),1);
  if(route.startsWith('/competitions/')){
   await page.waitForFunction(()=>document.querySelector('#app-competition-season')?.disabled===false);
   assert.equal(await page.evaluate(()=>window.faCompetitionContext?.selectedSeason),1);
   if(/\/competitions\/int-[12]\//.test(route))assert.equal(await page.evaluate(()=>window.faCompetitionContext?.seasonData),null);
   else await page.waitForFunction(()=>window.faCompetitionContext?.seasonData?.season===1);
  }
  checks++;
 }
 assert.deepEqual(zeroErrors,[],"Season 0 JS errors");await page.close();
 // A changed current catalogue must not reinterpret an explicitly supplied
 // historical rules snapshot, scores or table. Interception is test-only.
 for(const id of ['IT-1','int-1','int-2']){
  const historyPage=await browser.newPage({viewport:{width:390,height:900}});
  await historyPage.route('**/competitions/_shared/manifest.json',async route=>{
   const response=await route.fetch(),json=await response.json();
   const definition=json.competitions.find(definition=>definition.id===id);definition.rules.phases[0].points.win=2;
   if(id==='IT-1'){definition.rules.phases[0].rankOutcomes[0].to=2;definition.rules.phases[0].rankOutcomes[1].from=3;}
   else{
    const phase=definition.rules.phases.find(p=>p.id==='playoffs');phase.id='current-playoffs';
    phase.ties[0].participants[0].rank=6;phase.ties[1].participants[0].rank=5;
    definition.rules.phases[0].rankOutcomes.find(o=>o.targetPhaseId==='playoffs').targetPhaseId=phase.id;
    definition.metrics.phases[phase.id]=definition.metrics.phases.playoffs;delete definition.metrics.phases.playoffs;
    definition.capabilities.phaseIds=definition.rules.phases.map(p=>p.id);
   }
   await route.fulfill({response,json});
  });
  await historyPage.goto(base+'/competitions/'+id.toLowerCase()+'/rules',{waitUntil:"domcontentloaded"});
  await historyPage.waitForFunction(()=>document.querySelector('[data-rule-metric="points.win"]')?.textContent==='2');
  const historical=await historyPage.evaluate(()=>{
   const context=window.faCompetitionContext,definition=context.definition;
   const snapshot=JSON.parse(JSON.stringify(definition.rules));snapshot.phases[0].points.win=3;
   if(definition.category==='domestic'){snapshot.phases[0].rankOutcomes[0].to=1;snapshot.phases[0].rankOutcomes[1].from=2;}
   else{const phase=snapshot.phases.find(p=>p.id==='current-playoffs');phase.id='playoffs';phase.ties[0].participants[0].rank=5;phase.ties[1].participants[0].rank=6;snapshot.phases[0].rankOutcomes.find(o=>o.targetPhaseId==='current-playoffs').targetPhaseId='playoffs';}
   const participants=definition.category==='domestic'?window.faCompetitionDivision.clubs:Array.from({length:24},(_,i)=>({countryId:['IT','ENG','ES','DE','FR','PT','NL','BR'][Math.floor(i/3)],clubId:i%3+1,primaryName:'History Club '+i}));
   const key=i=>participants[i].countryId+'-'+participants[i].clubId;
   const data={season:1,rulesVersion:snapshot.version,rulesSnapshot:snapshot,participants,fixtures:definition.category==='international'?[{phaseId:'playoffs',tieId:'p512',leg:1,homeId:key(11),awayId:key(4),homeGoals:2,awayGoals:1,kickoff:null}]:null,results:[],statistics:definition.category==='international'?{standings:participants.map(club=>({club,played:6,won:0,drawn:6,lost:0,gf:0,ga:0,gd:0,pts:6,recent:[]}))}:null,status:'partial'};
   if(!window.faCompetitionContextApi.replaceSeasonData(data,context.revision))throw Error('Historical snapshot rejected');
   return JSON.stringify(data);
  });
  await historyPage.waitForFunction(()=>document.querySelector('[data-rule-metric="points.win"]')?.textContent==='3');
  assert.equal(await historyPage.evaluate(()=>JSON.stringify(window.faCompetitionContext.seasonData)),historical);
  await screenshot(historyPage,id.toLowerCase()+'-historical-rules.png');
  if(id.includes('-cup')){
   assert.equal(await historyPage.locator('[data-postseason-config-slot="p512:0"] [data-club-crest]').getAttribute('data-club-crest'),'ENG-2');
   assert.equal(await historyPage.locator('[data-fixture-round-choice="playoffs:1"]').count(),1);
   assert.equal(await historyPage.locator('[data-fixture-round-choice="current-playoffs:1"]').count(),0);
   await historyPage.evaluate(()=>window.faCompetitionRoute.set({view:'fixtures',matchday:'playoffs:1'}));
   assert.equal(await historyPage.locator('#app-fixtures-list [data-fixture-match]').count(),1);
   assert.deepEqual(await historyPage.locator('#app-fixtures-list .app-fixture-goals').allTextContents(),['2','1']);
   await historyPage.evaluate(()=>{
    const context=window.faCompetitionContext,row=(playerId,playerName,countryId,goals)=>({playerId,playerName,countryId,clubId:1,goals,assists:0,appearances:1,cleanSheets:0});
    window.faHistoryPlayerRecords.applyCanonicalHistory({source:'canonical',competitionId:context.definition.id,coverage:'complete',provenance:{approved:true},seasons:[{seasonId:1,status:'completed',dataStatus:'approved',playerStatsComplete:true,rulesVersion:context.definition.rules.version,rulesSnapshot:context.definition.rules,playerStats:[row('p1','First Player','IT',3),row('p1','First Player','ENG',3),row('p2','Second Player','ENG',6)]}]});
    window.faCompetitionRoute.set({view:'history'});
   });
   await historyPage.locator('[data-history-player-record="seasonGoals"] [data-history-detail]').click();
   await historyPage.waitForSelector('.app-history-player-dialog[open]');
   assert.equal(await historyPage.locator('dialog a[href="/clubs/it/1/overview"]').count(),1);
   assert.equal(await historyPage.locator('dialog a[href="/clubs/eng/1/overview"]').count(),2);
   await screenshot(historyPage,id+'-historical-player-dialog.png');
   await historyPage.keyboard.press('Escape');await historyPage.waitForSelector('.app-history-player-dialog[open]',{state:'detached'});
  }
  await historyPage.evaluate(()=>window.faCompetitionContextApi.clearSeasonData());
  await historyPage.waitForFunction(()=>document.querySelector('[data-rule-metric="points.win"]')?.textContent==='2');
  assert.equal(await historyPage.evaluate(()=>window.faCompetitionContext.seasonData),null);
  if(id==='IT-1'){
   await historyPage.locator('.fa-dev-widget-button').click();
   await historyPage.locator('[data-dev-control="season-number"]').fill('2');await historyPage.locator('[data-dev-control="season-number"]').dispatchEvent('change');
   await historyPage.waitForFunction(()=>window.faCompetitionContext?.selectedSeason===1&&window.faCompetitionContext?.seasonData?.rulesSnapshot?.phases[0].points.win===3);
   assert.notEqual(await historyPage.locator('#app-standings-body tr').nth(1).getAttribute('data-standing-outcome'),'champion');
   assert.notEqual(await historyPage.locator('#app-standings-compact-list>li').nth(1).getAttribute('data-standing-outcome'),'champion');
   await historyPage.evaluate(()=>window.faCompetitionRoute.set({view:'standings'}));
   await screenshot(historyPage,'it-1-historical-dev-standings.png');checks++;
  }
  await historyPage.close();checks++;
 }
 // PR 318: shared domestic qualification bands, localized legends and centered form letters.
 const formPage=await browser.newPage({viewport:{width:1440,height:900}});
 await formPage.goto(base+'/competitions/it-1/standings',{waitUntil:"domcontentloaded"});
 await formPage.evaluate(()=>{
  sessionStorage.setItem('football-architect:standings-dev-preview','on');
  sessionStorage.setItem('football-architect:standings-dev-season','2');
  sessionStorage.setItem('football-architect:standings-dev-matchdays','15');
  sessionStorage.removeItem('football-architect:calendar-dev-world-day');
  window.dispatchEvent(new Event('fa:fictional-standings-change'));
 });
 await formPage.reload({waitUntil:"domcontentloaded"});
 await formPage.waitForSelector('.app-world-form-glyph');
 for(const width of widths)for(const theme of ['dark','light'])for(const lang of Object.keys(languages)){
  await formPage.setViewportSize({width,height:900});
  await formPage.evaluate(({theme,lang})=>{document.documentElement.dataset.theme=theme;document.documentElement.lang=lang},{theme,lang});
  await formPage.waitForFunction(label=>document.querySelector('#competition-tab-standings')?.textContent===label,languages[lang]);
  const actual=await formPage.evaluate(()=>{
   const glyphs=[...document.querySelectorAll('.app-world-form-dot')].filter(el=>el.getBoundingClientRect().width>0).map(el=>el.querySelector('.app-world-form-glyph')||el);
   return {
    bands:[...document.querySelectorAll('#app-standings-body tr')].slice(0,7).map(el=>el.dataset.standingOutcome||''),
    centered:glyphs.length>0&&glyphs.every(el=>{const range=document.createRange();range.selectNodeContents(el);const text=range.getBoundingClientRect(),box=el.getBoundingClientRect();return Math.abs((text.left+text.right)-(box.left+box.right))<=2&&Math.abs((text.top+text.bottom)-(box.top+box.bottom))<=3}),
    labels:['sovereign','federation'].every(kind=>document.querySelector('#standings-outcome-'+kind+' [data-competition-outcome]').textContent===window.faCompetitionRulesView.legendLabel(window.faCompetitionContext.definition,{kind},document.documentElement.lang)),
    colors:['sovereign','federation'].map(kind=>getComputedStyle(document.querySelector('[data-standing-outcome="'+kind+'"]')).getPropertyValue('--standing-outcome-color').trim())
   };
  });
  assert.deepEqual(actual.bands,['champion','sovereign','sovereign','federation','federation','federation','']);
  assert.equal(actual.centered,true,'Form letter centering '+JSON.stringify({width,theme,lang}));
  assert.equal(actual.labels,true,'Localized qualification legend '+lang);
  assert.deepEqual(actual.colors,['#6B8FE3','#8D72C8']);checks++;
 }
 await formPage.close();
 checks+=await verifyFe04AccessibilityBrowser(browser);
 console.log("INT24 Chromium QA PASS: "+checks+" checks; "+screenshots+" screenshots");
}finally{await browser.close()}
