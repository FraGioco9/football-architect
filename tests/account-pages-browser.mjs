import {requestHandshake} from './helpers/request-handshake.mjs';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const playwright=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const browser=await playwright[process.env.FA_AUTH_BROWSER||'chromium'].launch({headless:true,...(process.env.FA_ACCOUNT_CHROME&&process.env.FA_AUTH_BROWSER!=='webkit'?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
const preview=createPreviewServer({subdomains:true,devPreview:false});
let checks=0;
async function chooseMenu(page,id,value){
 const trigger=page.locator('#'+id+'-trigger');
 assert.equal(await trigger.getAttribute('role'),'combobox');
 assert.equal(await trigger.getAttribute('class'),'language-trigger');
 await trigger.click();
 if(id==='nationality'){const field=await trigger.boundingBox(),menu=await page.locator('#nationality-menu').boundingBox();assert.ok(Math.abs(field.width-menu.width)<1,'Nationality dropdown matches the field width');assert.ok(menu.x>=0&&menu.x+menu.width<=await page.evaluate(()=>innerWidth),'Dropdown stays within viewport');}
 await page.locator('#'+id+'-menu [data-menu-value="'+value+'"]').click();
 assert.equal(await trigger.getAttribute('aria-expanded'),'false');
}

try{
 preview.listen(2000,'127.0.0.1');await once(preview,'listening');
 for(const language of ['en','de','es','fr','it'])for(const theme of ['dark','light'])for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   await context.addInitScript(({language,theme})=>{localStorage.setItem('football-architect:language',language);localStorage.setItem('football-architect:theme',theme);},{language,theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/player/session',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
   let payload;
   await page.route('**/api/player/register',r=>{payload=r.request().postDataJSON();return r.fulfill({status:409,contentType:'application/json',body:'{"error":{"code":"username_unavailable"}}'});});
   await page.goto('http://app.localhost:2000/account/register/');
   assert.equal(await page.locator('#nationality-search').count(),0,'Nationality menu has no search field');
   assert.equal(await page.locator('html').getAttribute('lang'),language);
   if(language==='en')assert.equal(new URL(page.url()).searchParams.has('lang'),false);
   assert.equal(new URL(await page.locator('.fa-shell-sidebar .app-brand').getAttribute('href'),page.url()).pathname,'/dashboard');
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   const panel=page.locator('main.app-main .app-authentication-card');
   assert.equal(await panel.count(),1);
   assert.equal(await panel.evaluate(el=>getComputedStyle(el).borderTopStyle),'solid');
   assert.equal(await page.locator('#account-language,#account-language-trigger,#account-go-back').count(),0);
   await page.locator('#nationality option[value="IT"]').waitFor({state:'attached'});
   await page.locator('[name=username]').fill('Francesco_9');
   await page.locator('[name=email]').fill('synthetic@example.invalid');
   await page.locator('[name=password]').fill('synthetic-test-password-2026');
   await page.locator('[name=city]').fill('Bologna');await chooseMenu(page,'nationality','IT');
   const longest=await page.locator('#nationality option').evaluateAll(options=>options.reduce((best,item)=>item.textContent.length>best.textContent.length?item:best).value);
   await chooseMenu(page,'nationality',longest);await chooseMenu(page,'nationality','IT');
   assert.equal(await page.locator('[name=username]').inputValue(),'Francesco_9');
   assert.equal(await page.locator('[name=password]').inputValue(),'synthetic-test-password-2026');
   assert.equal(await page.locator('#nationality').inputValue(),'IT');
   await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelector('[name=username]').getAttribute('aria-invalid')==='true');
   assert.deepEqual(payload,{email:'synthetic@example.invalid',password:'synthetic-test-password-2026',username:'Francesco_9',nationality:'IT',city:'Bologna'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#login-link').click();await page.waitForURL(url=>url.pathname==='/account/login');
   assert.equal(await page.locator('html').getAttribute('lang'),language);
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close();}
 }
 const context=await browser.newContext();
 try{
  await context.addInitScript(()=>{if(location.hostname==='localhost')localStorage.setItem('football-architect:language','fr');});
  const page=await context.newPage();let siteApi=0;
  await page.route('**/api/player/**',r=>{if(new URL(r.request().url()).hostname==='localhost')siteApi++;return r.fulfill({status:401,body:'{}',contentType:'application/json'});});
  await page.goto('http://localhost:2000/account/login/');
  await page.waitForURL(url=>url.hostname==='app.localhost'&&url.pathname==='/account/login');
  assert.equal(await page.locator('html').getAttribute('lang'),'fr');assert.equal(siteApi,0);checks++;
  let verified=0;
  await page.route('**/api/player/verify-email',r=>{verified++;return r.fulfill({status:200,body:'{"verified":true}',contentType:'application/json'});});
  await page.goto('http://app.localhost:2000/account/verify-email/?token='+'a'.repeat(64));
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('vérifié'));
  assert.equal(await page.locator('#account-language-trigger').count(),0);
  assert.equal(new URL(page.url()).searchParams.has('token'),false);assert.equal(verified,1);checks++;
  const resetHandshake=requestHandshake('password-reset/request');
  let release;
  await page.route('**/api/player/password-reset/request',r=>new Promise(resolve=>{release=async()=>{await r.fulfill({status:503,body:'{}',contentType:'application/json'});resolve();};resetHandshake.arrive();}));
  await page.goto('http://app.localhost:2000/account/recover/?lang=en');
  await page.locator('[name=email]').fill('synthetic@example.invalid');
  await page.locator('#request-button').click();await page.waitForFunction(()=>document.getElementById('request-button').disabled);
  await page.evaluate(()=>window.faAccountUI.choose('it'));
  await resetHandshake.ready;await release();
  await page.waitForFunction(()=>!document.getElementById('request-button').disabled);
  assert.equal(await page.locator('#request-button').textContent(),'Invia email di recupero');checks++;
  await page.goto('http://app.localhost:2000/account/register/?lang=it');
  await page.route('**/api/player/register',r=>r.fulfill({status:202,contentType:'application/json',body:'{"accepted":true,"verificationRequired":true}'}));
  await chooseMenu(page,'nationality','IT');
  await page.locator('[name=username]').fill('Another_Player');
  await page.locator('[name=email]').fill('synthetic@example.invalid');
  await page.locator('[name=password]').fill('synthetic-test-password-2026');
  await page.locator('#submit').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('controlla la tua email'));
  assert.equal(await page.locator('#nationality').inputValue(),'');
  assert.equal(await page.locator('#nationality-value').textContent(),'Non specificata');checks++;
  const unicodeCity='𐐀'.repeat(60);
  await page.locator('[name=city]').pressSequentially(unicodeCity);
  assert.equal(await page.locator('[name=city]').inputValue(),unicodeCity);
  await page.locator('[name=city]').fill('a'.repeat(101));
  assert.equal(await page.locator('[name=city]').evaluate(el=>el.validity.valid),false);checks++;
  if(process.env.FA_ACCOUNT_SCREENSHOT)await page.screenshot({path:process.env.FA_ACCOUNT_SCREENSHOT,fullPage:true});
 }finally{await context.close();}
 console.log('Account page browser matrix PASS: '+checks+' cases');
}finally{preview.closeAllConnections();await new Promise(r=>preview.close(r));await browser.close();}
