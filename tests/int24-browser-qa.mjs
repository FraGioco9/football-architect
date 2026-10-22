import {chromium} from "playwright";
import {mkdirSync} from "node:fs";
import assert from "node:assert/strict";

const base="http://127.0.0.1:2000";
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
   checks++;
  }
  await page.goto(base+"/competitions/"+cup,{waitUntil:"networkidle"});
  for(const [lang,label] of Object.entries(languages)){
   await page.evaluate(lang=>{document.documentElement.lang=lang},lang);
   await page.waitForFunction(expected=>document.querySelector("#competition-tab-standings")?.textContent===expected,label);
   checks++;
  }
  for(const theme of ["dark","light"]){
   await page.evaluate(value=>localStorage.setItem("football-architect:theme",value),theme);
   await page.reload({waitUntil:"networkidle"});
   assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
   await page.screenshot({path:out+"/"+cup+"-"+width+"-"+theme+".png",fullPage:true});
   checks++;
  }
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
 for(const route of ["/competitions/sovereign-cup/standings","/competitions/federation-cup/fixtures","/competitions/it-1/standings","/calendar","/clubs/it/1/overview"]){
  await page.goto(base+route,{waitUntil:"networkidle"});
  await page.waitForSelector('.fa-dev-widget-button');
  await page.locator('.fa-dev-widget-button').click();
  const season=page.locator('[data-dev-control="season-number"]');
  assert.equal(await season.getAttribute('min'),'0');
  await season.fill('0');await season.dispatchEvent('change');
  await page.waitForFunction(()=>document.querySelector('[data-dev-control="world-day"]')?.disabled===true);
  assert.equal(await page.locator('[data-dev-control="world-day-number"]').isDisabled(),true);
  assert.equal(await page.locator('[data-dev-control-row="world-day"] button:disabled').count(),2);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('football-architect:standings-dev-season')),'0');
  if(route.startsWith('/competitions/')){
   assert.equal(await page.locator('#app-competition-season').isDisabled(),true);
   assert.equal(await page.locator('#app-competition-season-value').innerText(),'No active season');
   assert.equal(await page.evaluate(()=>window.faCompetitionRoute.get().season),'1');
  }
  if(route==='/calendar')assert.equal(await page.locator('#calendar-season-picker').isDisabled(),true);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForSelector('.fa-dev-widget-button');
  assert.equal(await page.locator('[data-dev-control="world-day"]').isDisabled(),true);
  await page.locator('.fa-dev-widget-button').click();
  await page.locator('[data-dev-control="season-number"]').fill('1');
  await page.locator('[data-dev-control="season-number"]').dispatchEvent('change');
  await page.waitForFunction(()=>document.querySelector('[data-dev-control="world-day"]')?.disabled===false);
  assert.equal(await page.evaluate(()=>window.faDevWorldClockSnapshot?.current?.season),1);
  if(route.startsWith('/competitions/')){
   await page.waitForFunction(()=>document.querySelector('#app-competition-season')?.disabled===false);
  }
  checks++;
 }
 assert.deepEqual(zeroErrors,[],"Season 0 JS errors");await page.close();
 console.log("INT24 Chromium QA PASS: "+checks+" checks; 12 screenshots");
}finally{await browser.close()}
