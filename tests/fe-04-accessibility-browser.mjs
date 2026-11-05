// FE-04 real Chromium keyboard and five-locale checks on disposable loopback.
import assert from "node:assert/strict";
export async function verifyFe04AccessibilityBrowser(browser){
 const profiles=[{width:320,lang:"en",theme:"dark"},{width:390,lang:"de",theme:"light"},{width:768,lang:"es",theme:"dark"},{width:1440,lang:"fr",theme:"light"},{width:390,lang:"it",theme:"dark"}];
 const skips={en:"Skip to main content",de:"Zum Hauptinhalt springen",es:"Saltar al contenido principal",fr:"Aller au contenu principal",it:"Vai al contenuto principale"};
 const names={en:"Competition matches",de:"Ligaspiele",es:"Partidos de la competición",fr:"Matchs de la compétition",it:"Partite della competizione"};
 let cases=0;
 for(const profile of profiles){
  const context=await browser.newContext({viewport:{width:profile.width,height:900},reducedMotion:"reduce"});
  try{
   await context.addInitScript(({lang,theme})=>{localStorage.setItem("football-architect:language",lang);localStorage.setItem("football-architect:theme",theme)},profile);
   const page=await context.newPage();
   const response=await page.goto("http://app.localhost:2000/competitions/it-1/standings",{waitUntil:"networkidle",timeout:30000});assert.equal(response?.status(),200);
   const skip=page.locator("#fa-skip-link");await skip.waitFor({state:"attached"});
   assert.equal(await skip.textContent(),skips[profile.lang]);
   await skip.focus();await page.keyboard.press("Enter");
   assert.equal(await page.evaluate(()=>document.activeElement?.id),"main-content","Skip link focuses main");
   const selector=page.locator("#app-competition-season");
   await page.waitForFunction(()=>document.getElementById("app-competition-season")?.disabled===false);
   const before=new URL(page.url()).search;
   await selector.click();assert.equal(await selector.getAttribute("aria-expanded"),"true");
   await page.keyboard.press("Escape");assert.equal(await selector.getAttribute("aria-expanded"),"false");
   assert.equal(await selector.evaluate(node=>document.activeElement===node),true,"Escape restores focus");
   assert.equal(new URL(page.url()).search,before,"Escape preserves season and Debug");
   await page.locator("#competition-tab-fixtures").click();
   await page.waitForFunction(value=>document.getElementById("app-fixtures-list")?.getAttribute("aria-label")===value,names[profile.lang]);
   cases++;
  }finally{await context.close()}
 }
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:"reduce"});
 try{
  await context.route("**/api/player/session",request=>request.fulfill({status:401,contentType:"application/json",body:"{}"}));
  const page=await context.newPage();const response=await page.goto("http://app.localhost:2000/account/login",{waitUntil:"load",timeout:30000});assert.equal(response?.status(),200);
  await page.waitForFunction(()=>document.documentElement.dataset.accountReady==="true");
  await page.locator("#email-label").click();
  assert.equal(await page.locator('input[name="email"]').evaluate(node=>document.activeElement===node),true,"Email label activates input");
  const selector=page.locator("#account-language-trigger");await selector.click();await page.keyboard.press("Escape");
  assert.equal(await selector.getAttribute("aria-expanded"),"false");
  assert.equal(await selector.evaluate(node=>document.activeElement===node),true);
  cases++;
 }finally{await context.close()}
 console.log("FE-04 Chromium keyboard/locales PASS: "+cases+" scenarios");
 return cases;
}
