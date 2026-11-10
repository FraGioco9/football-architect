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
 for(const language of Object.keys(labels))for(const width of [320,390,1440])for(const authenticated of [false,true]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await context.addInitScript(lang=>localStorage.setItem('football-architect:language',lang),language);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let sessions=0, sessionLists=0;
   await page.route('**/api/player/session',r=>{sessions++;return r.fulfill({status:authenticated?200:401,contentType:'application/json',body:authenticated?JSON.stringify({authenticated:true,actor:{id:'synthetic-player',email:'synthetic@example.invalid'},csrfToken:'a'.repeat(64),permissions:[],profile:width===1440?{username:null,nationality:null,city:null}:{username:'synthetic_player',nationality:'IT',city:'Rome'}}):'{}'});});
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
    assert.equal(await page.locator('#fa-skip-link').getAttribute('href'),'#main-content');
    assert.equal(await page.locator('.fa-shell-nav [aria-current="page"]').getAttribute('id'),'app-nav-profile');
    assert.equal(await page.locator('h1').textContent(),labels[language]);
    assert.equal(await page.locator('#identity').textContent(),'synthetic@example.invalid');
    assert.equal(await page.locator('#username-row').isVisible(),true);
    assert.equal(await page.locator('#nationality-row').isVisible(),true);
    assert.equal(await page.locator('#city-row').isVisible(),true);
    if(width!==1440){
     assert.equal(await page.locator('#username-value').textContent(),'synthetic_player');
     const country=new Intl.DisplayNames([language],{type:'region'}).of('IT');
     assert.equal(await page.locator('#nationality-value').textContent(),country);
     assert.equal(await page.locator('#city-value').textContent(),'Rome');
    }
    const table=await page.locator('#profile-panel .app-profile-table').boundingBox();
    const layout=await page.locator('.app-profile').boundingBox();
    const title=await page.locator('#title').boundingBox();
    const signOut=await page.locator('#logout-button').boundingBox();
    assert.ok(Math.abs((table.x+table.width/2)-(layout.x+layout.width/2))<1,'Table is centered');
    assert.ok(Math.abs(title.x-layout.x)<1,'Title stays at the start of the page');
    assert.ok(Math.abs((signOut.x+signOut.width)-(table.x+table.width))<1,'Sign out aligns with the table edge');
    assert.equal(await page.locator('#change-form').isVisible(),false);
    assert.equal(await page.locator('#profile-tab').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('[data-profile-edit]').count(),3);
    assert.equal(await page.locator('#edit-profile-form').isVisible(),false);
    await page.locator('[data-profile-edit="city"]').click();
    const cancel=await page.locator('#cancel-profile-button').boundingBox();
    const save=await page.locator('#save-profile-button').boundingBox();
    assert.ok(Math.abs(cancel.y-save.y)<1&&cancel.x+cancel.width<=save.x);
    await page.locator('#cancel-profile-button').click();
    await page.locator('#profile-tab').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#security-tab').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('#profile-panel .app-profile-table').isVisible(),false);
    const securityTable=page.locator('#security-panel .app-profile-table');
    assert.deepEqual(await securityTable.locator('th').evaluateAll(cells=>cells.map(cell=>cell.id)),
     ['security-email-label','security-password-label']);
    assert.equal(await page.locator('#security-email-value').textContent(),'synthetic@example.invalid');
    assert.equal(await page.locator('#security-password-mask').textContent(),'********');
    const securityBounds=await securityTable.boundingBox();
    assert.ok(Math.abs(securityBounds.x-table.x)<1&&Math.abs(securityBounds.width-table.width)<1);
    assert.equal(await page.locator('#change-email-form').isVisible(),false);
    assert.equal(await page.locator('#change-email-title').isVisible(),true);
    await page.locator('#change-title').click();
    assert.equal(await page.locator('#change-form').isVisible(),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#change-form').isVisible(),false);
    assert.equal(await page.locator('#change-title').getAttribute('aria-expanded'),'false');
    if(language==='en'&&width===390){
     await page.route('**/api/player/account/change-email',async route=>{
      assert.equal(route.request().headers()['x-csrf-token'],'a'.repeat(64));
      assert.deepEqual(route.request().postDataJSON(),{email:'updated@example.invalid',currentPassword:'current-password-2026'});
      await route.fulfill({status:202,json:{accepted:true,verificationRequired:true}});
     });
     await page.locator('#change-email-title').click();
     await page.locator('#change-email-form [name=email]').fill('updated@example.invalid');
     await page.locator('#change-email-form [name=currentPassword]').fill('current-password-2026');
     await page.locator('#change-email-button').click();
     await page.locator('#status[data-kind=success]').filter({hasText:'both addresses'}).waitFor();
     await page.locator('#profile-tab').click();
     assert.equal(await page.locator('#identity').textContent(),'synthetic@example.invalid');
     let current={username:'synthetic_player',nationality:'IT',city:'Rome'};
     for(const [field,value,display] of [['username','renamed_player','renamed_player'],['city','Milan','Milan'],['nationality','FR','France']]){
      const expected={...current,[field]:value};
      await page.route('**/api/player/account/profile',async route=>{
       assert.deepEqual(route.request().postDataJSON(),{[field]:value});
       await route.fulfill({status:200,json:{profile:expected}});
      },{times:1});
      const pencil=page.locator(`[data-profile-edit="${field}"]`);
      await pencil.click();
      const form=page.locator(`#${field}-row #edit-profile-form`);
      assert.equal(await form.locator('input:visible, [role=combobox]:visible').count(),1);
      const input=form.locator(`[name="${field}"]`);
      if(field==='nationality'){
       const dropdown=form.getByRole('combobox');
       assert.equal(await input.isVisible(),false);
       await dropdown.click();
       const list=form.getByRole('listbox');
       await list.waitFor();
       await page.keyboard.press('Escape');
       assert.equal(await list.isVisible(),false);
       assert.equal(await form.isVisible(),true);
       await dropdown.click();
       await list.locator('[data-menu-value="'+value+'"]').click();
       assert.equal(await dropdown.getAttribute('aria-expanded'),'false');
      }else await input.fill(value);
      await form.locator('#save-profile-button').click();
      await page.locator(`#${field}-value`).filter({hasText:display}).waitFor();
      assert.equal(await pencil.getAttribute('aria-expanded'),'false');
      current=expected;
     }
     await page.locator('[data-profile-edit="city"]').click();
     await page.locator('#edit-profile-form [name=city]').fill('Uncommitted');
     await page.locator('#cancel-profile-button').click();
     assert.equal(await page.locator('#city-value').textContent(),'Milan');
    }
    assert.equal(await page.locator('#security, #delete-form, #revoke-button').count(),0);
    assert.equal(sessionLists,0,'Profile does not request the session list');
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
