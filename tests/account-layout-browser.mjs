// Account spacing and popup geometry against real markup, with isolated API responses.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const playwright=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright'),engine=process.env.FA_AUTH_BROWSER||'chromium';
const browser=await playwright[engine].launch({headless:true,...(process.env.FA_ACCOUNT_CHROME&&engine==='chromium'?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
const server=createPreviewServer({subdomains:true,devPreview:false});let checks=0;
try{
 server.listen(2000,'127.0.0.1');await once(server,'listening');
 for(const language of ['en','de','es','fr','it'])for(const theme of ['dark','light'])for(const [width,height] of [[1366,768],[390,844],[320,568]]){
  const context=await browser.newContext({viewport:{width,height}});
  try{
   await context.addInitScript(({language,theme})=>{localStorage.setItem('football-architect:language',language);localStorage.setItem('football-architect:theme',theme)},{language,theme});
   const page=await context.newPage();await page.route('**/api/player/**',r=>r.fulfill({status:401,body:'{}',contentType:'application/json'}));
   for(const route of ['register','login']){
    await page.goto('http://app.localhost:2000/account/'+route);await page.waitForFunction(()=>document.documentElement.dataset.accountReady==='true');
    if(route==='login'||width>320)assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,`${route} fits ${width}x${height} ${language}`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const id of route==='register'?['account-language','nationality']:['account-language']){
     const trigger=page.locator('#'+id+'-trigger');await trigger.scrollIntoViewIfNeeded();
     const before=await page.evaluate(()=>scrollY);await trigger.click();
     const menu=page.locator('#'+id+'-menu'),bounds=await menu.boundingBox();
     assert.ok(bounds.y>=7&&bounds.y+bounds.height<=height-7,`${id} remains inside viewport: ${JSON.stringify(bounds)}`);
     assert.ok(['above','below'].includes(await menu.getAttribute('data-menu-placement')));
     assert.equal(await page.evaluate(()=>scrollY),before,'Opening a dropdown does not scroll the page');
     await page.keyboard.press('End');assert.equal(await page.evaluate(()=>scrollY),before,'Keyboard navigation scrolls the menu only');
     await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert.equal(await trigger.evaluate(el=>el===document.activeElement),false);
    }
    checks++;
   }
  }finally{await context.close();}
 }
 // Go back must preserve a valid hidden origin across login, register and locales.
 const translations={en:'Go back',de:'Zurück',es:'Volver',fr:'Retour',it:'Torna indietro'};
 for(const [language,label] of Object.entries(translations))for(const route of ['login','register']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
   await context.addInitScript(({language})=>{
    localStorage.setItem('football-architect:language',language);
    sessionStorage.setItem('football-architect:login-return','/calendar?season=2&calendarView=week');
   },{language});
   const page=await context.newPage();
   await page.route('**/api/player/**',r=>r.fulfill({status:401,body:'{}',contentType:'application/json'}));
   await page.goto('http://app.localhost:2000/account/'+route);
   await page.waitForFunction(()=>document.documentElement.dataset.accountReady==='true');
   const goBack=page.locator('#account-go-back');
   assert.equal((await goBack.textContent()).trim(),label,route+' '+language+' back label');
   assert.equal(await goBack.getAttribute('href'),'/calendar?season=2&calendarView=week');
   assert.equal(new URL(page.url()).searchParams.has('next'),false);
   assert.equal(await goBack.evaluate(el=>getComputedStyle(el).textDecorationLine.includes('underline')),true,'Go back uses the same underlined link treatment');
   await goBack.click();
   // Wait for Calendar hydration, so its canonicalization cannot race this assertion.
   await page.waitForFunction(()=>document.documentElement.dataset.calendarView==='week'&&new URL(location.href).searchParams.get('calendarView')==='week');
   await page.waitForURL('**/calendar?season=2&calendarView=week');
   checks++;
  }finally{await context.close();}
 }
 console.log(engine+' account spacing and dropdown placement PASS: '+checks+' cases');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await browser.close();}
