import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const playwright=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const browser=await playwright[process.env.FA_AUTH_BROWSER||'chromium'].launch({headless:true,...(process.env.FA_ACCOUNT_CHROME&&process.env.FA_AUTH_BROWSER!=='webkit'?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
const server=createPreviewServer({subdomains:true,devPreview:false});let checks=0;
try{
 server.listen(2000,'127.0.0.1');await once(server,'listening');
 for(const theme of ['dark','light'])for(const width of [390,1440])for(const route of ['/clubs','/account/login/','/account/register/']){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   await context.addInitScript(value=>localStorage.setItem('football-architect:theme',value),theme);
   const page=await context.newPage();await page.route('**/api/player/session',r=>r.fulfill({status:401,body:'{}',contentType:'application/json'}));
   await page.goto('http://app.localhost:2000'+route);
   const field=page.locator(route==='/clubs'?'.nav01-filters>input':'[name=email]');await field.waitFor();
   if(route!=='/clubs'){
    await page.locator('#email-label').click();
    assert.equal(await field.evaluate(el=>document.activeElement===el),true,'Native label text activates its associated field');
   }
   const before=await field.boundingBox();await field.fill('Selectable text');await field.selectText();
   const style=await field.evaluate(el=>{const s=getComputedStyle(el);return {selection:el.value.slice(el.selectionStart,el.selectionEnd),select:s.getPropertyValue('user-select')||s.getPropertyValue('-webkit-user-select'),border:s.borderTopColor,shadow:s.boxShadow,}});
   if(await field.getAttribute('type')!=='email')assert.equal(style.selection,'Selectable text');assert.equal(await field.inputValue(),'Selectable text');assert.equal(style.select,'text');assert.ok(style.shadow.includes('inset'),'Focus uses a stronger inset border');
   const expected=await field.evaluate(el=>{const sample=document.createElement('span');sample.style.color='var(--muted)';el.after(sample);const color=getComputedStyle(sample).color;sample.remove();return color});
   await page.waitForFunction(({selector,color})=>getComputedStyle(document.querySelector(selector)).borderTopColor===color,{selector:route==='/clubs'?'.nav01-filters>input':'[name=email]',color:expected});const after=await field.boundingBox();assert.equal(before.width,after.width);assert.equal(before.height,after.height);
   if(route==='/account/login/'){
    assert.equal(await page.locator('#account-language-trigger').count(),0,'Login has no language selector');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('[name=password]').evaluate(el=>el===document.activeElement),true,'Tab advances from Email to Password');
    checks++;continue;
   }
   const dropdownSelector=route==='/clubs'?'.nav01-filter .language-trigger':'#nationality-trigger';
   const dropdown=page.locator(dropdownSelector).first();
   await dropdown.click();
   assert.equal(await dropdown.getAttribute('aria-expanded'),'true','Dropdown opens with the pointer');
   if(route==='/clubs')await page.waitForFunction(({selector,color})=>getComputedStyle(document.querySelector(selector)).borderTopColor===color,{selector:dropdownSelector,color:expected});
   await dropdown.click();
   assert.equal(await dropdown.getAttribute('aria-expanded'),'false');
   if(route==='/clubs')await page.waitForFunction(selector=>getComputedStyle(document.querySelector(selector)).boxShadow==='none',dropdownSelector);
   assert.equal(await dropdown.evaluate(el=>document.activeElement===el),true,'Second click retains trigger focus');
   await dropdown.focus();await page.keyboard.press('ArrowDown');
   await page.keyboard.press('Escape');
   assert.equal(await dropdown.evaluate(el=>document.activeElement===el),true,'Escape restores trigger focus');assert.equal(await dropdown.getAttribute('aria-expanded'),'false');checks++;
  }finally{await context.close();}
 }
 console.log('Shared focus and selectable input browser PASS: '+checks+' cases');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await browser.close();}
