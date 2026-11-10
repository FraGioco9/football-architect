import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const playwright=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const browser=await playwright[process.env.FA_AUTH_BROWSER||'chromium'].launch({headless:true,...(process.env.FA_ACCOUNT_CHROME&&process.env.FA_AUTH_BROWSER!=='webkit'?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
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
   let sessions=0, sessionLists=0;
   await page.route('**/api/player/session',r=>{sessions++;return r.fulfill({status:authenticated?200:401,contentType:'application/json',body:authenticated?JSON.stringify({authenticated:true,actor:{id:'synthetic-player',email:'synthetic@example.invalid'},csrfToken:'a'.repeat(64),permissions:[]}):'{}'});});
   await page.route('**/api/player/sessions',r=>{
    sessionLists++;
    return r.fulfill({status:200,contentType:'application/json',body:'{"sessions":[]}'});
   });
   await page.goto('http://app.localhost:2000/dashboard');
   const profile=page.locator('#app-nav-profile');await profile.waitFor();
   assert.equal(await profile.getAttribute('aria-label'),labels[language]);
   assert.equal(new URL(await page.locator('.app-brand').getAttribute('href'),page.url()).pathname,'/dashboard');
   if(language==='en')assert.equal(new URL(await profile.getAttribute('href')).searchParams.has('lang'),false);
   assert.equal(await page.locator('#app-nav-settings').evaluate(el=>el.nextElementSibling.id),'app-nav-profile');
   assert.equal(sessions,0,'Public page load does not probe player session');
   await profile.click();
   if(authenticated){
    await page.waitForURL(url=>url.pathname==='/account');await page.locator('#protected').waitFor();
    assert.equal(await page.locator('.fa-shell-topbar').isVisible(),true);
    assert.equal(await page.locator('.fa-shell-nav [aria-current="page"]').getAttribute('id'),'app-nav-profile');
    assert.equal(await page.locator('h1').textContent(),labels[language]);
    assert.equal(await page.locator('#identity').textContent(),'synthetic@example.invalid');
    assert.equal(await page.locator('#change-form').isVisible(),true);
    assert.equal(await page.locator('#logout-button').isVisible(),true);
    assert.equal(await page.locator('#delete-form').isVisible(),false);
    assert.equal(sessionLists,0,'Session list is deferred until security is opened');
    await page.locator('#security summary').click();
    await page.locator('#sessions-summary').filter({hasText:': 0'}).waitFor();
    assert.equal(sessionLists,1);
    assert.equal(await page.locator('#delete-form').isVisible(),true);
   }else{
    await page.waitForURL(url=>url.pathname==='/account/login');
    assert.equal(new URL(page.url()).searchParams.get('next'),null);
    await page.route('**/api/player/login',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await page.locator('[name=email]').fill('synthetic@example.invalid');
    await page.locator('[name=password]').fill('synthetic-password-123');
    await page.locator('#submit').click();await page.waitForURL(url=>url.pathname==='/dashboard');
   }
   assert.equal(new URL(page.url()).hostname,'app.localhost');
   assert.equal(await page.locator('html').getAttribute('lang'),language);
   assert.deepEqual(errors,[]);checks++;
  }finally{await context.close();}
 }
 const journey=await browser.newContext();
 try{
  const page=await journey.newPage();let attempts=0;
  await page.route('**/api/player/session',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.route('**/api/player/login',r=>r.fulfill({status:++attempts===1?401:200,contentType:'application/json',body:'{}'}));
  await page.goto('http://app.localhost:2000/calendar?season=1&week=3');
  const previous=page.url();await page.locator('#app-nav-profile').click();
  await page.waitForURL(url=>url.pathname==='/account/login');
  assert.equal(new URL(page.url()).searchParams.has('next'),false);
  await page.locator('#register-link').click();await page.locator('#login-link').click();
  await page.reload();
  for(let attempt=0;attempt<2;attempt++){
   await page.locator('[name=email]').fill('synthetic@example.invalid');
   await page.locator('[name=password]').fill('synthetic-password-123');
   await page.locator('#submit').click();
   if(attempt===0){await page.locator('#message[data-kind="error"]').filter({hasText:/credentials/i}).waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('football-architect:login-return')),new URL(previous).pathname+new URL(previous).search);}
  }
  await page.waitForURL(previous);checks++;
 }finally{await journey.close()}
 const tabs=await browser.newContext();
 try{
  await tabs.route('**/api/player/session',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await tabs.route('**/api/admin/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await tabs.route('**/api/player/login',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  const pages=[];
  for(const route of ['/calendar?season=1&week=3','/clubs?q=Rome','/settings?view=admin']){
   const page=await tabs.newPage();await page.goto('http://app.localhost:2000'+route);const previous=page.url();
   if(route==='/settings?view=admin')await page.locator('[data-admin-signin-link] a').click();else await page.locator('#app-nav-profile').click();
   await page.waitForURL(url=>/^\/account\/login\/?$/.test(url.pathname));
   assert.equal(new URL(page.url()).searchParams.has('next'),false);pages.push([page,previous]);
  }
  for(const [page,previous] of pages){
   await page.locator('[name=email]').fill('synthetic@example.invalid');
   await page.locator('[name=password]').fill('synthetic-password-123');await page.locator('#submit').click();
   await page.waitForURL(previous);checks++;
  }
 }finally{await tabs.close()}
 const fallback=await browser.newContext();
 try{
  const page=await fallback.newPage(),visited=[];
  page.on('request',r=>{if(r.isNavigationRequest())visited.push(new URL(r.url()).pathname)});
  await page.route('**/api/player/session',r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
  await page.goto('http://app.localhost:2000/dashboard');await page.locator('#app-nav-profile').click();
  await page.waitForURL(url=>url.pathname==='/account/login');
  assert.equal(visited.includes('/account'),false);checks++;
 }finally{await fallback.close()}
 console.log('Profile sidebar browser matrix PASS: '+checks+' cases');
}finally{preview.closeAllConnections();await new Promise(r=>preview.close(r));await browser.close();}
