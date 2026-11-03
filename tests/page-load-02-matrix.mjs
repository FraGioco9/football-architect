// Independent PAGE-LOAD-02 transport/shell evidence, invoked by both FULL engines.
// This records the scope actually exercised; it is not blanket P01-P23 acceptance.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:4,seasonNumber:2,day:20,phase:'active'};
const provenance={kind:'none',sourceRef:null,resultAuthority:null};
const competitionCatalog=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
export const pageLoadCases=[
 ['P01','/'],['P02','/dashboard'],['P03','/competitions'],
 ...['standings','fixtures','overview','stats','history','rules','awards','postseason','teams'].map(view=>[
  {standings:'P04',fixtures:'P05',overview:'P06',stats:'P07',history:'P08'}[view]||'P09',
  '/competitions/it-1/'+view+'?season=2']),
 ...['int-1','int-2'].flatMap(cup=>['standings','fixtures','postseason','stats','history','rules','awards'].map(view=>[
  {standings:'P12',fixtures:'P11',postseason:'P11'}[view]||'P13','/competitions/'+cup+'/'+view+'?season=2'])),
 ['P14','/calendar?season=2&calendarView=season'],['P15','/calendar?season=2&calendarView=week'],
 ['P05','/competitions/it-2/fixtures?season=2'],['P05','/competitions/it-2/postseason?season=2'],
 ['P16','/clubs'],
 ...['overview','roster','fixtures','stats','history'].map(view=>[view==='overview'?'P17':'P18','/clubs/it/1/'+view]),
 ['P19','/settings'],['P20','/settings'],
 ...['login','register','recover','verify-email',''].map(view=>['P21','/account'+(view?'/'+view:'')]),
 ['P22','/guide']
];

const json=(route,status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
const nextFrame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const bracketShape=page=>page.evaluate(()=>{
 const root=document.getElementById('app-postseason-bracket');
 return root?{ties:root.querySelectorAll('[data-postseason-config-tie]').length,first:root.querySelectorAll('[data-app-aria="postseasonFirstLeg"]').length,second:root.querySelectorAll('[data-app-aria="postseasonSecondLeg"]').length}:null;
});
const expectedBracket=route=>{
 if(!/\/(fixtures|postseason)\?/.test(route))return null;
 if(/^\/competitions\/int-[12]\//.test(route))return {ties:11,first:10,second:10};
 if(route.startsWith('/competitions/it-1/'))return {ties:0,first:1,second:1};
 if(route.startsWith('/competitions/it-2/'))return {ties:0,first:2,second:2};
 return null;
};


export async function verifyPageLoadMatrix(browser,engine,origin){
 const evidence={engine,sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  scope:'Independent shell, delayed/failed/confirmed-empty transport, refresh/history and presentation matrix. Populated sporting outcomes and native iPhone Safari require separate evidence.',
  notApplicable:[{item:'P10',reason:'Neither cup has a canonical Overview route; both cups existing views are independently listed.'}],pages:[]};
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let mode='empty',gate=null,gateRequests=0;const writes=[],errors=[];
 await context.addInitScript(()=>{
  let prefs={lang:'en',theme:'dark'};try{prefs=JSON.parse(window.name)||prefs}catch{}
  localStorage.setItem('football-architect:language',prefs.lang);
  localStorage.setItem('football-architect:theme',prefs.theme);
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()!=='GET'){writes.push({path,method:request.method()});return json(route,405,{error:{code:'read-only-audit'}})}
  if(gate){gateRequests++;await gate}
  try{
   if(mode==='failure')return await json(route,503,{error:{code:'audit-unavailable'}});
   if(path==='/api/world')return await json(route,200,{world});
   if(path==='/api/player/session')return await json(route,200,{authenticated:true,actor:{id:'audit-player',email:'audit@example.invalid'},csrfToken:'a'.repeat(64),permissions:[]});
   if(path==='/api/player/sessions')return await json(route,200,{sessions:[]});
   if(path==='/api/player/permissions')return await json(route,200,{permissions:[]});
   const competition=path.match(/^\/api\/competitions\/([^/]+)\/seasons\/(\d+)$/);
   if(competition)return await json(route,200,{schemaVersion:1,providerId:'authoritative-world',competitionId:competition[1],selectedSeason:Number(competition[2]),world,status:'empty',reason:'calendar-unpublished',data:null,provenance});
   const calendar=path.match(/^\/api\/calendar\/seasons\/(\d+)\/days\/(\d+)$/);
   if(calendar)return await json(route,200,{schemaVersion:1,providerId:'authoritative-world',scope:'calendar',selectedSeason:Number(calendar[1]),day:Number(calendar[2]),world,status:'empty',reason:'calendar-unpublished',data:null,provenance});
   return await json(route,401,{error:{code:'unauthorized'}});
  }catch(error){if(!/closed|handled|cancel|invalid|intercept/i.test(error.message))throw error}
 });
 const snapshot=()=>page.evaluate(()=>{
  const main=document.querySelector('main');
  const title=[...(main?.querySelectorAll('h1')||[])].find(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden');
  const box=title?.getBoundingClientRect();
  return {title:title?.textContent.trim(),titleWidth:box?.width,titleHeight:box?.height,
   overflow:document.documentElement.scrollWidth>innerWidth+2,
   lang:document.documentElement.lang,theme:document.documentElement.dataset.theme,
   season:window.faCompetitionContext?.selectedSeason,
   calendarDays:document.querySelectorAll('#world-calendar button[data-calendar-day]').length,
   clubTabs:document.querySelectorAll('.club-tabs a').length};
 });
 try{
  for(const [item,route] of pageLoadCases){
   const row={item,route,checks:[],apiRequestsWhileDelayed:0},errorStart=errors.length;
   evidence.pages.push(row);
   // Keep transport genuinely pending while the independent route mounts.
   // Await a rendering condition, never a fixed timing delay.
   let release;gateRequests=0;gate=new Promise(resolve=>release=resolve);mode='empty';
   try{
    await page.goto(origin+route,{waitUntil:'domcontentloaded'});
    await page.locator('main h1:visible').first().waitFor({state:'visible'});
    if(route.startsWith('/competitions/')&&route.includes('?'))await page.waitForFunction(()=>!!window.faCompetitionContext);
    if(route.startsWith('/clubs/'))await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
    await nextFrame(page);
    const cold=await snapshot();
    assert.ok(cold.title&&cold.titleWidth>0&&cold.titleHeight>0,route+' cold static title');
    assert.equal(cold.overflow,false,route+' cold overflow');
    if(route.startsWith('/calendar'))assert.equal(cold.calendarDays,56,route+' static 56-day structure');
    if(route.startsWith('/clubs/'))assert.equal(cold.clubTabs,5,route+' static club tabs');
    if(route.startsWith('/competitions/')&&route.includes('?'))assert.equal(cold.season,2,route+' explicit viewed season before API');
    // The world request can finish before a page-specific competition request
    // enters its gate. A confirmed world must remain visible; only unresolved
    // data is hidden. Never assert blank text after a valid authoritative read.
    const worldProgress=await page.evaluate(()=>{
     const state=window.faWorldState?.get?.(),full=document.querySelector('.fa-shell-date-full'),
       short=document.querySelector('.fa-shell-date-short');
     return {current:state?.current||null,full:full?.textContent.trim()||'',
       short:short?.textContent.trim()||'',ready:full?.hasAttribute('data-fa-world-ready')||false,
       visible:full?getComputedStyle(full).visibility:null};
    });
    if(worldProgress.current){
     assert.equal(worldProgress.ready,true,route+' accepted world must mark header ready');
     assert.equal(worldProgress.short,worldProgress.current.season+' · '+worldProgress.current.day+'/56',
       route+' accepted world must display real current progress');
    }else{
     assert.equal(worldProgress.ready,false,route+' pending world must not be marked ready');
     assert.equal(worldProgress.visible,'hidden',route+' unresolved world must remain invisible');
    }
   const bracketExpected=expectedBracket(route);
   if(bracketExpected){
    row.bracketCold=await bracketShape(page);
    assert.deepEqual(row.bracketCold,bracketExpected,route+' canonical first-paint knockout leg/tie count');
    row.checks.push('static-knockout-ties-and-legs');
   }
   row.initial=cold;row.apiRequestsWhileDelayed=gateRequests;row.checks.push('cold-title-and-shell-before-api','pending-or-valid-world-progress');
   }finally{gate=null;release()}
   await page.waitForLoadState('networkidle');await nextFrame(page);
   row.confirmedEmpty=await snapshot();
   assert.ok(row.confirmedEmpty.title,route+' confirmed-empty title');
   if(route.includes('/stats')){
    for(const view of ['overview','teams','players']){
     const button=page.locator('[data-stats-view="'+view+'"]');
     if(await button.count()){
      await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true',route+' stats '+view);
      assert.equal((await snapshot()).overflow,false,route+' stats '+view+' overflow');
      row.checks.push('stats-'+view);
     }
    }
   }
   row.checks.push('confirmed-empty-shell');
   await page.reload({waitUntil:'networkidle'});
   assert.ok((await snapshot()).title,route+' hard refresh');
   if(expectedBracket(route))assert.deepEqual(await bracketShape(page),row.bracketCold,route+' no duplicated knockout ties or legs after hard refresh');
   row.checks.push('hard-refresh');
   // A same-document history round-trip must retain its actual main node.
   await page.evaluate(()=>{window.pageLoadAuditMain=document.querySelector('main');history.pushState(history.state,'',location.pathname+location.search+'#page-load-audit')});
   await page.goBack();await nextFrame(page);
   assert.equal(await page.evaluate(()=>window.pageLoadAuditMain===document.querySelector('main')),true,route+' Back retains main');
   await page.goForward();await nextFrame(page);
   assert.equal(await page.evaluate(()=>window.pageLoadAuditMain===document.querySelector('main')),true,route+' Forward retains main');
   row.checks.push('same-document-back-forward');
   mode='failure';await page.reload({waitUntil:'networkidle'});await nextFrame(page);
   assert.ok((await snapshot()).title,route+' failed transport preserves shell');
   if(route==='/account')assert.equal(await page.locator('#protected').isVisible(),false,'failed session cannot expose private account');
   if(item==='P20')assert.equal(await page.locator('[data-admin-signed-in]').isVisible(),false,'failed Admin session cannot expose operator controls');
   row.checks.push('failed-transport-shell-and-private-boundary');mode='empty';
   // Cover all five languages, both themes and every required width per view.
   // This is dimension coverage, not a claim of the full Cartesian product.
   for(const [i,lang] of ['en','de','es','fr','it'].entries()){
    const theme=i%2?'light':'dark';
    await page.evaluate(prefs=>window.name=JSON.stringify(prefs),{lang,theme});
    await page.goto(origin+route,{waitUntil:'networkidle'});
    const translated=await snapshot();assert.equal(translated.lang,lang,route+' locale');
    assert.equal(translated.theme,theme,route+' theme');
    for(const width of [320,390,768,1440]){
     await page.setViewportSize({width,height:844});await nextFrame(page);
     assert.equal((await snapshot()).overflow,false,route+' '+lang+' '+theme+' '+width);
    }
   }
   row.checks.push('five-locales-two-themes-four-widths');
   assert.deepEqual(errors.slice(errorStart),[],route+' page errors');
   row.status='PASS';console.log('PAGE-LOAD-02 '+engine+' '+item+' '+route+' PASS '+row.checks.join(', '));
  }

  // PAGE-LOAD-02: explicitly audit each of the 16 domestic leagues and both
  // international cups. A shared renderer passing on IT-1 is not proof that
  // another catalogue entry, season, tab, or knockout shape works.
  evidence.competitionPages=[];
  const ids=competitionCatalog.competitions;
  assert.equal(ids.length,18,'canonical competition catalogue must contain 18 competitions');
  for(const def of ids){
   const id=def.id.toLowerCase(),route='/competitions/'+id+'/standings?season=1';
   const row={id:def.id,category:def.category,checks:[],views:[]};
   evidence.competitionPages.push(row);
   const errorStart=errors.length;
   let release;gateRequests=0;gate=new Promise(resolve=>release=resolve);
   try{
    await page.goto(origin+route,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.faCompetitionContext);
    const cold=await page.evaluate(()=>({
     title:[...document.querySelectorAll('main h1')].some(x=>x.getClientRects().length>0),
     season:window.faCompetitionContext?.selectedSeason,
     tabs:[...document.querySelectorAll('.app-competition-tabs [role="tab"]')].map(x=>x.id),
     tableHeaders:document.querySelectorAll('#competition-panel-standings th').length,
     bracket:document.querySelector('#app-postseason-bracket')!==null
    }));
    assert.equal(cold.title,true,def.id+' static title');
    assert.equal(cold.season,1,def.id+' supported season before API');
    assert.equal(cold.tabs.length,7,def.id+' seven canonical tabs');
    assert.equal(new Set(cold.tabs).size,7,def.id+' unique tab identities');
    assert.ok(cold.tableHeaders>0,def.id+' static table headers');
    assert.equal(cold.bracket,true,def.id+' static knockout scaffold');
    row.cold=cold;row.checks.push('cold-static-tabs-standings-and-postseason');
   }finally{gate=null;release()}
   await page.waitForLoadState('networkidle');
   await page.waitForFunction(()=>!!window.faCompetitionContext);
   // Exercise every actual tab and its URL without reloading this document.
   const views=['standings','postseason','fixtures','stats','history','rules','awards'];
   for(const view of views){
    await page.locator('#competition-tab-'+view).click();
    const observed=await page.evaluate(()=>{
     const selected=[...document.querySelectorAll('.app-competition-tabs [role="tab"][aria-selected="true"]')];
     const panels=[...document.querySelectorAll('.app-competition-panel')].filter(x=>!x.hidden);
     return {pathname:location.pathname,season:new URLSearchParams(location.search).get('season'),
      selected:selected.map(x=>x.id),panels:panels.map(x=>x.id),
      overflow:document.documentElement.scrollWidth>innerWidth+2,
      main:document.querySelector('main')};
    });
    assert.equal(observed.pathname,'/competitions/'+id+'/'+view,def.id+' route '+view);
    assert.equal(observed.season,'1',def.id+' viewed season '+view);
    assert.deepEqual(observed.selected,['competition-tab-'+view],def.id+' selected tab '+view);
    assert.deepEqual(observed.panels,['competition-panel-'+view],def.id+' visible panel '+view);
    assert.equal(observed.overflow,false,def.id+' horizontal overflow '+view);
    if(view==='postseason'){
     const shape=await bracketShape(page);
     const expected=def.category==='international'?{ties:11,first:10,second:10}:
       def.tier===2?{ties:0,first:2,second:2}:{ties:0,first:1,second:1};
     assert.deepEqual(shape,expected,def.id+' knockout legs and ties');
     row.bracket=shape;
    }
    row.views.push(view);
   }
   await page.reload({waitUntil:'networkidle'});
   assert.equal(new URL(page.url()).pathname,'/competitions/'+id+'/awards',def.id+' hard refresh retains selected view');
   assert.deepEqual(errors.slice(errorStart),[],def.id+' page-level JavaScript errors');
   row.checks.push('all-seven-tabs-routes-and-refresh','canonical-knockout-topology');
   row.status='PASS';
   console.log('PAGE-LOAD-02 '+engine+' competition '+def.id+' PASS '+row.views.join(','));
  }
  assert.deepEqual(writes,[],'audit must not send mutations');
  evidence.status='PASS';
 }catch(error){
  evidence.status='FAIL';evidence.error=String(error);evidence.url=page.url();
  await page.screenshot({path:'int24-browser-artifacts/page-load-02-'+engine+'-failure.png',fullPage:true}).catch(()=>{});
  throw error;
 }finally{
  gate=null;mkdirSync('int24-browser-artifacts',{recursive:true});
  writeFileSync('int24-browser-artifacts/page-load-02-'+engine+'.json',JSON.stringify(evidence,null,2));
  await context.close();
 }
}
