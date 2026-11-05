// Optional real-browser smoke against the running canonical local server.
// Run after node tools/dev.mjs and Playwright browser installation.
import assert from 'node:assert/strict';
const engine=process.env.FA_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'Unsupported browser engine');
const playwright=await import('playwright');
const browser=await playwright[engine].launch({headless:true});
try{
 const page=await browser.newPage();
 const site=await page.goto('http://localhost:2000/',{waitUntil:'domcontentloaded'});
 assert.equal(site?.status(),200);
 const appLink=page.locator('a[href="http://app.localhost:2000/dashboard"]').first();
 assert.ok(await appLink.count(),'Site must link to canonical app origin');
 await appLink.click();
 await page.waitForURL('http://app.localhost:2000/dashboard');
 for(const path of ['/competitions/it-1/standings?season=1','/competitions/int-1/fixtures?season=1']){
  const url='http://app.localhost:2000'+path;
  const navigation=await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.equal(navigation?.status(),200,path);
  const refresh=await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(refresh?.status(),200,path+' refresh');
  assert.equal(page.url(),url);
 }
 console.log('DEV-ENV-01 '+engine+' browser navigation and hard refresh PASS');
}finally{await browser.close()}
