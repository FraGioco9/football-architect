import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const {chromium}=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.FA_ACCOUNT_CHROME?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
const server=createPreviewServer({subdomains:true,devPreview:false});let checks=0;
try{
 server.listen(2000,'127.0.0.1');await once(server,'listening');
 for(const language of ['en','de','es','fr','it'])for(const theme of ['dark','light'])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   await context.addInitScript(({language,theme})=>{localStorage.setItem('football-architect:language',language);localStorage.setItem('football-architect:theme',theme);},{language,theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let writes=0,status=202;
   await page.route('**/api/player/session',r=>r.fulfill({status:401,body:'{}'}));
   await page.route('**/api/player/register',r=>{writes++;return r.fulfill({status,body:status===409?'{"error":{"code":"username_unavailable"}}':'{}',contentType:'application/json'});});
   await page.goto('http://app.localhost:2000/account/register/');
   const password=page.locator('[name=password]'),toggle=page.locator('[data-password-toggle]').first();
   assert.equal(await toggle.count(),1,'Password visibility control exists');
   await password.fill('synthetic-password-2026');await toggle.click();
   assert.equal(await password.getAttribute('type'),'text');assert.equal(await toggle.getAttribute('aria-pressed'),'true');
   assert.equal(await password.inputValue(),'synthetic-password-2026');
   const nextLanguage=language==='en'?'it':'en';await page.locator('#account-language-trigger').click();
   await page.locator('#account-language-menu [data-menu-value="'+nextLanguage+'"]').click();
   assert.equal(await password.getAttribute('type'),'text');assert.equal(await toggle.getAttribute('aria-label'),nextLanguage==='en'?'Hide password':'Nascondi password');
   assert.equal(await password.inputValue(),'synthetic-password-2026');
   assert.equal(await page.locator('[data-password-help]').getAttribute('data-met'),'true');
   await page.locator('[name=username]').fill('x!');await page.locator('[name=email]').focus();
   const username=page.locator('[name=username]');assert.equal(await username.getAttribute('aria-invalid'),'true');
   assert.ok((await username.getAttribute('aria-describedby')).includes('username-help'));
   await username.fill('Synthetic_9');assert.equal(await username.getAttribute('aria-invalid'),null);
   await page.locator('#submit').click();assert.equal(writes,0);
   assert.equal(await page.locator('[name=email]').getAttribute('aria-invalid'),'true');
   await page.locator('[name=email]').fill('synthetic@example.invalid');
   assert.equal(await page.locator('fieldset.account-optional').count(),1);
   assert.equal(await page.locator('[name=city]').isVisible(),true);
   const trigger=page.locator('#nationality-trigger');await trigger.click();
   const search=page.locator('#nationality-search');await search.fill('zzzznoresult');
   assert.equal(await page.locator('#nationality-empty').isVisible(),true);await search.press('Enter');assert.equal(writes,0);
   await search.fill('IT');assert.equal(await page.locator('#nationality-menu [data-menu-value=IT]').isVisible(),true);
   await search.fill(await page.locator('#nationality option[value=IT]').textContent());await search.press('ArrowDown');await search.press('Enter');
   assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#nationality').inputValue(),'IT');
   await trigger.click();const countryName=await page.locator('#nationality option[value=CI]').textContent();await search.fill(countryName.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
   assert.equal(await page.locator('#nationality-menu [data-menu-value="CI"]').isVisible(),true);
   await search.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
   await page.locator('#submit').click();await page.waitForFunction(()=>document.getElementById('status').dataset.kind==='success');
   assert.equal(await page.locator('#account-next-step').isVisible(),true);
   assert.equal(await page.locator('#login-link').evaluate(el=>el.classList.contains('cta')),true);
   assert.equal(await password.getAttribute('type'),'password');assert.equal(await toggle.getAttribute('aria-pressed'),'false');
   await username.fill('Synthetic_9');await page.locator('[name=email]').fill('synthetic@example.invalid');await password.fill('synthetic-password-2026');
   status=409;await page.locator('#submit').click();
   await page.waitForFunction(()=>document.querySelector('[name=username]').getAttribute('aria-invalid')==='true');
   assert.equal(await page.locator('#account-next-step').isVisible(),false);
   await page.locator('[name=email]').focus();assert.equal(await username.getAttribute('aria-invalid'),'true','Server errors persist until the field is edited');
   assert.ok((await username.getAttribute('aria-describedby')).includes('username-help'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);checks++;
  }finally{await context.close()}
 }
 for(const language of ['en','de','es','fr','it']){
  const context=await browser.newContext();
  try{
   await context.addInitScript(lang=>localStorage.setItem('football-architect:language',lang),language);
   const page=await context.newPage();let status=202;
   await page.route('**/api/player/password-reset/request',r=>r.fulfill({status,body:'{}',contentType:'application/json'}));
   await page.route('**/api/player/password-reset/complete',r=>r.fulfill({status:200,body:'{}',contentType:'application/json'}));
   await page.goto('http://app.localhost:2000/account/recover/');
   await page.locator('[name=email]').fill('synthetic@example.invalid');await page.locator('#request-button').click();
   await page.waitForFunction(()=>document.getElementById('message').dataset.kind==='success');
   assert.equal(await page.locator('#account-next-step').isVisible(),true);assert.equal(await page.locator('#account-next-step').getAttribute('data-step'),'recovery');
   status=503;await page.locator('#request-button').click();
   await page.waitForFunction(()=>document.getElementById('message').dataset.kind==='error');assert.equal(await page.locator('#account-next-step').isVisible(),false);
   await page.goto('http://app.localhost:2000/account/recover/?token='+'a'.repeat(64));
   const password=page.locator('[name=newPassword]');await password.fill('synthetic-password-2026');
   await page.locator('[data-password-toggle]').click();assert.equal(await password.getAttribute('type'),'text');
   await page.locator('#complete-button').click();await page.waitForFunction(()=>document.getElementById('account-next-step').dataset.step==='reset');
   assert.equal(await page.locator('#complete-form').isVisible(),false);assert.equal(new URL(page.url()).searchParams.has('token'),false);
   assert.equal(await password.getAttribute('type'),'password');checks++;
  }finally{await context.close()}
 }
 const account=await browser.newContext();
 try{
  const page=await account.newPage();
  await page.route('**/api/player/session',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:true,actor:{id:'synthetic-player',email:'synthetic@example.invalid'},csrfToken:'a'.repeat(64),permissions:[]})}));
  await page.route('**/api/player/sessions',r=>r.fulfill({status:200,body:'{"sessions":[]}'}));
  await page.goto('http://app.localhost:2000/account/');await page.locator('#protected').waitFor();
  for(const [formId,buttonId,path] of [['change-form','change-button','change-password'],['delete-form','delete-button','delete']]){
   let pending,calls=0;await page.route('**/api/player/account/'+path,r=>{calls++;pending=r;});
   const form=page.locator('#'+formId);
   for(const input of await form.locator('input').all())await input.fill((await input.getAttribute('name'))==='confirmation'?'DELETE MY ACCOUNT':'synthetic-password-2026');
   await page.locator('#'+buttonId).click();
   for(let attempt=0;!pending&&attempt<100;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
   assert.equal(calls,1,'The pending request has reached the handler');
   assert.equal(await page.locator('#'+buttonId).isDisabled(),true,'Actual submit is disabled while pending');
   assert.equal(await form.locator('[data-password-toggle]').first().isDisabled(),false);
   await form.evaluate(el=>el.requestSubmit());assert.equal(calls,1,'Repeated submissions are single-flight');
   await pending.fulfill({status:503,contentType:'application/json',body:'{}'});
   await page.waitForFunction(id=>!document.getElementById(id).disabled,buttonId);checks++;
  }
 }finally{await account.close()}
 console.log('Account usability browser PASS: '+checks+' cases');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await browser.close()}
