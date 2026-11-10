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
    const pane=page.locator('.fa-shell-content-scroll');
    assert.equal(await pane.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,`${route} fits the app pane at ${width}px`);
    for(const id of route==='register'?['nationality']:[]){
     const trigger=page.locator('#'+id+'-trigger');await trigger.scrollIntoViewIfNeeded();
     const before=await pane.evaluate(el=>el.scrollTop);await trigger.click();
     const menu=page.locator('#'+id+'-menu'),bounds=await menu.boundingBox();
     const clip=await pane.boundingBox();
     assert.ok(bounds.y>=clip.y+7&&bounds.y+bounds.height<=Math.min(height,clip.y+clip.height)-7,`${id} remains inside the app pane: ${JSON.stringify(bounds)}`);
     assert.ok(['above','below'].includes(await menu.getAttribute('data-menu-placement')));
     assert.equal(await pane.evaluate(el=>el.scrollTop),before,'Opening a dropdown does not scroll the page');
     await page.keyboard.press('End');assert.equal(await pane.evaluate(el=>el.scrollTop),before,'Keyboard navigation scrolls the menu only');
     await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'Escape restores dropdown trigger focus');
    }
    checks++;
   }
  }finally{await context.close();}
 }
 // Removing the visible back control must not consume the hidden post-sign-in destination.
 for(const language of ['en','de','es','fr','it'])for(const route of ['login','register','recover','verify-email']){
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
   assert.equal(await page.locator('#account-go-back,#account-language-trigger').count(),0);
   assert.equal(await page.locator('html').getAttribute('lang'),language);
   assert.equal(new URL(page.url()).searchParams.has('next'),false);
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('football-architect:login-return')),'/calendar?season=2&calendarView=week');
   checks++;
  }finally{await context.close();}
 }
 console.log(engine+' account spacing and dropdown placement PASS: '+checks+' cases');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await browser.close();}
