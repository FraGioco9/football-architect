import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const {chromium}=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.FA_ACCOUNT_CHROME?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
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
    assert.equal(await field.evaluate(el=>document.activeElement===el),false,'Label text does not activate its field');
   }
   const before=await field.boundingBox();await field.fill('Selectable text');await field.selectText();
   const style=await field.evaluate(el=>{const s=getComputedStyle(el);return {selection:el.value.slice(el.selectionStart,el.selectionEnd),select:s.userSelect,border:s.borderTopColor,shadow:s.boxShadow,muted:getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()}});
   if(await field.getAttribute('type')!=='email')assert.equal(style.selection,'Selectable text');assert.equal(await field.inputValue(),'Selectable text');assert.equal(style.select,'text');assert.ok(style.shadow.includes('inset'),'Focus uses a stronger inset border');
   const expected=await field.evaluate(el=>{const sample=document.createElement('span');sample.style.color='var(--muted)';el.after(sample);const color=getComputedStyle(sample).color;sample.remove();return color});
   assert.equal(style.border,expected);const after=await field.boundingBox();assert.equal(before.width,after.width);assert.equal(before.height,after.height);
   const dropdown=page.locator(route==='/clubs'?'.nav01-filter .language-trigger':'#account-language-trigger').first();
   await dropdown.click();
   await page.waitForFunction(({selector,color})=>getComputedStyle(document.querySelector(selector)).borderTopColor===color,{selector:route==='/clubs'?'.nav01-filter .language-trigger':'#account-language-trigger',color:expected});
   await page.keyboard.press('Escape');checks++;
  }finally{await context.close();}
 }
 console.log('Shared focus and selectable input browser PASS: '+checks+' cases');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await browser.close();}
