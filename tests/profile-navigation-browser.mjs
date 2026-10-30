import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const playwright=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const browser=await playwright.chromium.launch({headless:true,...(process.env.FA_ACCOUNT_CHROME?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
const preview=createPreviewServer({subdomains:true,devPreview:false});
let checks=0;
try{
 preview.listen(2000,'127.0.0.1');await once(preview,'listening');
 const labels={en:'Profile',de:'Profil',es:'Perfil',fr:'Profil',it:'Profilo'};
 for(const language of Object.keys(labels))for(const width of [390,1440])for(const authenticated of [false,true]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await context.addInitScript(lang=>localStorage.setItem('football-architect:language',lang),language);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let sessions=0;
   await page.route('**/api/player/session',r=>{sessions++;return r.fulfill({status:authenticated?200:401,contentType:'application/json',body:authenticated?JSON.stringify({authenticated:true,actor:{id:'synthetic-player',email:'synthetic@example.invalid'},csrfToken:'a'.repeat(64),permissions:[]}):'{}'});});
   await page.route('**/api/player/sessions',r=>r.fulfill({status:200,contentType:'application/json',body:'{"sessions":[]}'}));
   await page.goto('http://app.localhost:2000/dashboard');
   const profile=page.locator('#app-nav-profile');await profile.waitFor();
   assert.equal(await profile.getAttribute('aria-label'),labels[language]);
   assert.equal(new URL(await page.locator('.app-brand').getAttribute('href'),page.url()).pathname,'/dashboard');
   if(language==='en')assert.equal(new URL(await profile.getAttribute('href')).searchParams.has('lang'),false);
   assert.equal(await page.locator('#app-nav-settings').evaluate(el=>el.nextElementSibling.id),'app-nav-profile');
   assert.equal(sessions,0,'Public page load does not probe player session');
   await profile.click();
   if(authenticated){
    await page.waitForURL(url=>url.pathname==='/account/');await page.locator('#protected').waitFor();
   }else{
    await page.waitForURL(url=>url.pathname==='/account/login/');
    assert.equal(new URL(page.url()).searchParams.get('next'),'/account/');
   }
   assert.equal(new URL(page.url()).hostname,'app.localhost');
   assert.equal(await page.locator('html').getAttribute('lang'),language);
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close();}
 }
 const fallback=await browser.newContext();
 try{
  const page=await fallback.newPage(),visited=[];
  page.on('request',r=>{if(r.isNavigationRequest())visited.push(new URL(r.url()).pathname)});
  await page.route('**/api/player/session',r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
  await page.goto('http://app.localhost:2000/dashboard');await page.locator('#app-nav-profile').click();
  await page.waitForURL(url=>url.pathname==='/account/login/');
  assert.equal(visited.includes('/account/'),false);checks++;
 }finally{await fallback.close()}
 console.log('Profile sidebar browser matrix PASS: '+checks+' cases');
}finally{preview.closeAllConnections();await new Promise(r=>preview.close(r));await browser.close();}
