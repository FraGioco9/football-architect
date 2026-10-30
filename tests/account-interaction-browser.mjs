// Real account UI, isolated synthetic API responses: never sends email or uses remote D1.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const playwright=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const engine=process.env.FA_AUTH_BROWSER||'chromium';
const browser=await playwright[engine].launch({headless:true,...(process.env.FA_ACCOUNT_CHROME&&engine==='chromium'?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
const server=createPreviewServer({subdomains:true,devPreview:false});let checks=0;
const surfaces='input:not([type=hidden]),textarea,.language-trigger';
try{
 server.listen(2000,'127.0.0.1');await once(server,'listening');
 for(const language of ['en','de','es','fr','it'])for(const theme of ['dark','light'])for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:{width:mobile?390:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  try{
   await context.addInitScript(({language,theme})=>{localStorage.setItem('football-architect:language',language);localStorage.setItem('football-architect:theme',theme);},{language,theme});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/player/**',r=>{
    const path=new URL(r.request().url()).pathname;
    const body=path.endsWith('/session')?{authenticated:true,actor:{id:'synthetic-player',email:'synthetic@example.invalid'},csrfToken:'a'.repeat(64),permissions:[]}:path.endsWith('/sessions')?{sessions:[]}:{};
    return r.fulfill({status:path.endsWith('/session')||path.endsWith('/sessions')?200:503,contentType:'application/json',body:JSON.stringify(body)});
   });
   for(const route of ['register','recover','verify-email','account','login']){
    // Only account home gets a restored session; login remains visible.
    if(route==='login')await page.route('**/api/player/session',r=>r.fulfill({status:401,body:'{}',contentType:'application/json'}));
    await page.goto('http://app.localhost:2000/account/'+(route==='account'?'':route+'/'));
    await page.waitForFunction(()=>document.documentElement.dataset.accountReady==='true');
    if(route==='account')await page.locator('#protected').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),language);
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    // Language sits inside a label: moving from the button to its label must clear hover.
    const trigger=page.locator('#account-language-trigger');
    if(!mobile){
     await trigger.hover();assert.equal(await trigger.getAttribute('data-field-pointer-hover'),'');
     await page.locator('#account-language-label').hover();
     assert.equal(await page.locator('[data-field-pointer-hover]').count(),0,'Label never highlights the nested dropdown');
    }
    const value=await page.locator('#account-language').inputValue();
    await trigger.click();assert.equal(await trigger.getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),false,'ESC removes focus');
    assert.equal(await page.locator('#account-language').inputValue(),value);
    await trigger.click();await trigger.click();
    assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert.equal(await trigger.evaluate(el=>el===document.activeElement),false);
    await trigger.click();await page.locator('#account-language-menu [data-menu-value="'+value+'"]').click();
    await trigger.click();assert.equal(await trigger.getAttribute('aria-expanded'),'true','Reopens after selection');
    await page.keyboard.press('Tab');assert.equal(await trigger.getAttribute('aria-expanded'),'false','Tab closes without trapping focus');
    await page.locator('h1').click();
    const fields=page.locator('input:not([type=hidden]):visible');
    for(const field of await fields.all()){
     if(await field.getAttribute('id')==='nationality-search')continue;
     if(!mobile){
      await field.hover();assert.equal(await field.getAttribute('data-field-pointer-hover'),'');
      // Assert the settled hover tokens, not just the hit-test marker.
      await page.waitForFunction(el=>{const sample=document.createElement('span');sample.style.color='var(--fa-field-hover-border)';el.after(sample);const expected=getComputedStyle(sample).color;sample.remove();return getComputedStyle(el).borderTopColor===expected},await field.elementHandle());
     }
     await field.fill('Synthetic_text_2026');
     if(await field.getAttribute('type')!=='email'){
      await field.selectText();assert.equal(await field.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd)),'Synthetic_text_2026');
      await field.press('Backspace');assert.equal(await field.inputValue(),'');
     }
     await field.evaluate(el=>el.blur());
    }
    for(const copy of await page.locator('label span,small,.account-field-error,[role=status]').all()){
     if(await copy.evaluate(el=>!!el.closest('.language-trigger'))||!await copy.isVisible()||!(await copy.textContent()).trim())continue;
     if(!mobile){await copy.hover();assert.equal(await page.locator('[data-field-pointer-hover]').count(),0,'Label/help/error does not highlight a field: '+await copy.evaluate(el=>el.outerHTML)+' hovered '+await page.locator('[data-field-pointer-hover]').evaluateAll(els=>els.map(el=>el.outerHTML)));}
    }
    // Country search closes on ESC, keeps its value and resets its filter on reopen.
    if(route==='register'){
     const country=page.locator('#nationality-trigger');await country.click();
     await page.locator('#nationality-search').fill('IT');await page.locator('#nationality-menu [data-menu-value=IT]').click();
     await country.click();await page.locator('#nationality-search').fill('zzzz');await page.keyboard.press('Escape');
     assert.equal(await page.locator('#nationality').inputValue(),'IT');assert.equal(await page.locator('#nationality-search').evaluate(el=>el===document.activeElement),false);
     await country.click();assert.equal(await page.locator('#nationality-search').inputValue(),'');await page.keyboard.press('Escape');
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);checks++;console.log(engine,language,theme,mobile?'mobile':'desktop',route,'PASS');
   }
  }finally{await context.close();}
 }
 console.log(engine+' account interaction matrix PASS: '+checks+' cases');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await browser.close();}
