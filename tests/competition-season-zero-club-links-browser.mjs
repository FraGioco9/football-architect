// Regression: Season 0 must not publish unconfirmed identities or standings.
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
   assert.equal(await page.locator('#app-standings-body [data-world-club],#app-standings-compact-list [data-world-club]').count(),0,
    'Unconfirmed Season 0 entrants must not be rendered for any competition');
   assert.equal(await page.locator('#app-standings-body .app-competition-empty-row').count(),1);
   assert.equal(await page.locator('#app-standings-compact-list .app-world-mobile-empty').count(),1);
   assert.equal(await page.locator('#app-standings-body a.app-world-club-name,#app-standings-compact-list a.app-world-mobile-club-name').count(),0);
   assert.equal(await page.locator('#app-standings-body .app-competition-empty-row').textContent(),'No standings available yet.');
   checks++;
  }finally{await context.close();}
 }
 console.log('Season 0 unconfirmed entrants browser PASS: '+checks+' cases ('+engine+')');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await browser.close();}
