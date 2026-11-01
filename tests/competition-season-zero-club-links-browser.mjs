// Regression for preserved build-time club identities before any fictional season starts.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const playwright=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const engine=process.env.FA_AUTH_BROWSER||'chromium';
const browser=await playwright[engine].launch({headless:true,...(process.env.FA_ACCOUNT_CHROME&&engine!=='webkit'?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
const server=createPreviewServer();let checks=0;
try{
 server.listen(2000,'127.0.0.1');await once(server,'listening');
 for(const width of [1440,390])for(const id of ['it-1','eng-2','int-1','int-2']){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   await context.addInitScript(()=>sessionStorage.setItem('football-architect:standings-dev-season','0'));
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:2000/competitions/'+id+'/standings');
   await page.waitForFunction(()=>window.faCompetitionRoute&&window.faFixtures&&document.documentElement.dataset.faDevStandingsPending===undefined);
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.faDevCurrentSeason),'0');
   assert.equal(await page.evaluate(()=>window.faCompetitionContext.seasonData),null,'Season 0 cannot fabricate season results');
   if(id.startsWith('int')){
    assert.equal(await page.locator('#app-standings-body [data-world-club],#app-standings-compact-list [data-world-club]').count(),0,'Unqualified international clubs must remain unknown');
    assert.equal(await page.locator('#app-standings-body .app-competition-empty-row').count(),1);
   }else{
    const desktop=page.locator('#app-standings-body a.app-world-club-name');
    assert.equal(await desktop.count(),16,'Every Season 0 desktop club name must be a link');
    assert.equal(await page.locator('#app-standings-compact-list a.app-world-mobile-club-name').count(),16);
    assert.equal(await page.locator('#app-standings-body [data-standing-rank],#app-standings-body [data-standing-outcome],#app-standings-body .app-world-form-dot').count(),0,'Link hydration must not introduce sporting data');
    const statistics=await page.locator('#app-standings-body td').allTextContents();
    assert.ok(statistics.every(value=>value==='—'),'All Season 0 statistics remain unknown');
    const link=width===390?page.locator('#app-standings-compact-list a.app-world-mobile-club-name').first():desktop.first();
    const target=await link.getAttribute('href');assert.match(target,/^\/clubs\/(it|eng)\/\d{1,2}\/overview$/);
    await link.click();await page.waitForURL('**'+target);assert.equal(new URL(page.url()).pathname,target);
   }
   checks++;
  }finally{await context.close();}
 }
 console.log('Season 0 club links browser PASS: '+checks+' cases ('+engine+')');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await browser.close();}
