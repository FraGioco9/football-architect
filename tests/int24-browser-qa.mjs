import {chromium} from "playwright";
import {mkdirSync} from "node:fs";
import assert from "node:assert/strict";

// Match the canonical app origin used by generated <base> URLs and DEV modules.
const base="http://app.localhost:2000";
const out="int24-browser-artifacts";
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const widths=[1440,390,320];
const cups=["sovereign-cup","federation-cup"];
const views=["standings","postseason","fixtures","stats","history","rules","awards"];
const languages={en:"Standings",de:"Tabelle",es:"Clasificación",fr:"Classement",it:"Classifica"};
let checks=0;
try {
 for(const cup of cups)for(const width of widths){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  for(const view of views){
   const url=base+"/competitions/"+cup+"/"+view;
   const response=await page.goto(url,{waitUntil:"networkidle"});
   assert.equal(response?.status(),200,url);
   await page.waitForSelector('#competition-tab-'+view+'[aria-selected="true"]');
   assert.equal(await page.locator("#competition-panel-"+view).isVisible(),true);
   assert.equal(await page.locator(".app-competition-header").count(),1);
   assert.equal(await page.locator("#division-detail-name").innerText(),cup==="sovereign-cup"?"Sovereign Cup":"Federation Cup");
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
    assert.equal(await page.locator('.fa-awards-card').count(),11);
    assert.equal(await page.locator('.fa-awards-card-promotion,.fa-awards-card-playoff').count(),0);
    assert.equal(await page.locator('[data-award-status="available"]').count(),0);
   }
   if(view==='fixtures'){
    assert.equal(await page.locator('[data-fixture-round-choice]').count(),13);
    assert.equal(await page.locator('[data-fixture-round-choice="30"]').count(),0);
    assert.equal(await page.locator('#app-fixtures-toolbar').isVisible(),false);
   }
   if(view==='postseason')assert.equal(await page.locator('[data-postseason-config-tie]').count(),11);
   checks++;
  }
  await page.goto(base+"/competitions/"+cup,{waitUntil:"networkidle"});
  for(const [lang,label] of Object.entries(languages)){
   await page.evaluate(lang=>{document.documentElement.lang=lang},lang);
   await page.waitForFunction(expected=>document.querySelector("#competition-tab-standings")?.textContent===expected,label);
   const headings={en:"Competition format",de:"Wettbewerbsformat",es:"Formato de competición",fr:"Format de la compétition",it:"Formula della competizione"};
   await page.waitForFunction(expected=>document.querySelector('#rules-format')?.textContent===expected,headings[lang]);
   assert.equal(await page.locator('[data-rule-metric="league.matches"]').textContent(),'72');
   checks++;
  }
  for(const theme of ["dark","light"]){
   await page.evaluate(value=>localStorage.setItem("football-architect:theme",value),theme);
   await page.reload({waitUntil:"networkidle"});
   assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
   await page.locator('#competition-tab-postseason').click();
   await page.screenshot({path:out+"/"+cup+"-"+width+"-"+theme+".png",fullPage:true});
   checks++;
  }
  // Only this test supplies fictional cup data; the public/runtime code never generates it.
  await page.evaluate(()=>{
   const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
   const participants=Array.from({length:24},(_,i)=>({countryId:countries[Math.floor(i/3)],clubId:i%3+1,primaryName:'QA Club '+(i+1),abbr:'Q'+(i+1)}));
   const id=i=>participants[i].countryId+'-'+participants[i].clubId;
   const fixtures=Array.from({length:12},(_,i)=>({phaseId:'league',round:1,homeId:id(i),awayId:id(i+12),homeGoals:null,awayGoals:null,kickoff:null}));
   const standings=participants.map(club=>({club,played:6,won:2,drawn:2,lost:2,gf:5,ga:5,gd:0,pts:8,recent:[]}));
   const data={season:1,rulesVersion:window.faCompetitionContext.definition.rules.version,participants,fixtures,results:[{id:'p89',winnerId:id(8)},{id:'q1',winnerId:id(0),legs:[{homeId:id(8),awayId:id(0),homeGoals:1,awayGoals:0},{homeId:id(0),awayId:id(8),homeGoals:2,awayGoals:0}]}],statistics:{standings},status:'partial'};
   if(!window.faCompetitionContextApi.replaceSeasonData(data,window.faCompetitionContext.revision))throw Error('QA supplied data rejected');
  });
  assert.equal(await page.locator('#app-standings-body tr').count(),24);
  assert.equal(await page.locator('[data-postseason-config-slot="q1:0"]').innerText(),'QA Club 1');
  assert.equal(await page.locator('[data-postseason-config-slot="q1:1"]').innerText(),'QA Club 9');
  assert.equal(await page.locator('[data-postseason-score="q1:0:aggregate"]').innerText(),'2');
  await page.screenshot({path:out+'/'+cup+'-'+width+'-supplied-knockouts.png',fullPage:true});
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
  await page.reload({waitUntil:"networkidle"});
  assert.equal(await page.locator("#competition-panel-awards").isVisible(),true);
  await page.goBack({waitUntil:"networkidle"});
  assert.equal(await page.locator("#competition-panel-postseason").isVisible(),true);
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
 for(const route of ["/competitions/sovereign-cup/standings","/competitions/federation-cup/fixtures","/competitions/it-1/standings","/calendar","/clubs/it/1/overview"]){
  console.log("Season 0 QA route: "+route);
  await page.goto(base+route,{waitUntil:"networkidle"});
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
   assert.equal(await page.locator('#competition-panel-'+(route.endsWith('/fixtures')?'fixtures':'standings')).isVisible(),true);
   assert.equal(await page.evaluate(()=>window.faCompetitionRoute.get().season),'1');
   assert.deepEqual(await page.evaluate(()=>({season:window.faCompetitionContext?.selectedSeason,data:window.faCompetitionContext?.seasonData})),{season:1,data:null});
  }
  if(route==='/calendar'){
   assert.equal(await page.locator('#calendar-season-picker').isDisabled(),false);
   assert.equal(await page.locator('#calendar-season-value').innerText(),'1');
  }
  await page.reload({waitUntil:'networkidle'});
  await page.waitForSelector('.fa-dev-widget-button');
  assert.equal(await page.locator('[data-dev-control="world-day"]').isDisabled(),true);
  if(route.startsWith('/competitions/')){
   assert.equal(await page.locator('#app-competition-season-value').innerText(),'1');
   assert.equal(await page.locator('#app-competition-season-unavailable').isVisible(),false);
   assert.equal(await page.locator('#competition-panel-'+(route.endsWith('/fixtures')?'fixtures':'standings')).isVisible(),true);
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
  await page.waitForFunction(()=>document.querySelector('[data-dev-control="world-day"]')?.disabled===false);
  assert.equal(await page.evaluate(()=>window.faDevWorldClockSnapshot?.current?.season),1);
  if(route.startsWith('/competitions/')){
   await page.waitForFunction(()=>document.querySelector('#app-competition-season')?.disabled===false);
   assert.equal(await page.evaluate(()=>window.faCompetitionContext?.selectedSeason),1);
   if(route.includes('-cup/'))assert.equal(await page.evaluate(()=>window.faCompetitionContext?.seasonData),null);
   else await page.waitForFunction(()=>window.faCompetitionContext?.seasonData?.season===1);
  }
  checks++;
 }
 assert.deepEqual(zeroErrors,[],"Season 0 JS errors");await page.close();
 console.log("INT24 Chromium QA PASS: "+checks+" checks; 18 screenshots");
}finally{await browser.close()}
