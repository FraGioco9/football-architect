// Unified Admin Settings browser acceptance: no retired Admin password form.
// Real Worker/D1 authorization and rollback are covered by backend Vitest suites.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const playwright=await import(process.env.FA_ADMIN_PLAYWRIGHT||require.resolve('playwright'));
const browser=await playwright.chromium.launch({headless:true});
const preview=createPreviewServer({subdomains:true,devPreview:false});
let checks=0;
try{
 preview.listen(2000,'127.0.0.1');await once(preview,'listening');
 for(const language of ['en','de','es','fr','it'])for(const theme of ['dark','light'])for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},locale:language});
  try{
   await context.addInitScript(({language,theme})=>{
    localStorage.setItem('football-architect:language',language);
    localStorage.setItem('football-architect:theme',theme);
   },{language,theme});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   let adminCalls=0;
   await page.route('**/api/admin/**',route=>{adminCalls++;return route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"unauthorized"}}'});});
   await page.route('**/api/player/permissions',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"unauthorized"}}'}));
   await page.goto('http://localhost:2000/settings');
   const signIn=page.locator('[data-admin-signin-link] a');
   await signIn.waitFor({state:'visible'});
   assert.equal(await signIn.getAttribute('href'),'/account/login?next=%2Fsettings%2F');
   assert.equal(await page.locator('[data-admin-login],#admin-email,#admin-password').count(),0);
   assert.equal(await page.locator('[data-admin-signed-in]').isVisible(),false);
   assert.equal(await page.locator('[data-admin-reset]').isEnabled(),false);
   assert.equal(await page.locator('[data-admin-command="nextPrepare"]').isEnabled(),false);
   assert.equal(await page.locator('label[for="admin-reset-confirm"]').count(),1);
   assert.equal(await page.locator('label[for="admin-next-season-confirm"]').count(),1);
   assert.equal(await page.locator('[data-admin-operation]').getAttribute('aria-live'),'polite');
   await signIn.focus();
   await page.keyboard.press('Enter');
   await page.waitForURL(url=>url.pathname==='/account/login/'||url.pathname==='/account/login');
   assert.equal(new URL(page.url()).searchParams.get('next'),'/settings/');
   assert.deepEqual(errors,[]);
   assert.equal(adminCalls>0,true,'Admin session is checked but never assumed');
   checks++;
  }finally{await context.close();}
 }
 const context=await browser.newContext();
 try{
  const page=await context.newPage();let adminCalls=0;
  await page.route('**/api/admin/**',route=>{adminCalls++;return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"admin_unavailable"}}'});});
  await page.goto('http://localhost:2000/dashboard');
  await page.waitForLoadState('networkidle');
  assert.equal(adminCalls,0,'Anonymous public browsing must not invoke Admin APIs');
  checks++;
 }finally{await context.close();}
 console.log('Unified Admin Settings browser contracts PASS: '+checks+' cases');
}finally{
 preview.closeAllConnections();await new Promise(resolve=>preview.close(resolve));
 await browser.close();
}
