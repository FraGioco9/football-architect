// PAGE-LOAD-02 P17/P18: real-browser regression for club crest and focus reuse.
// Run: node tests/page-load-02-club-browser.mjs (requires installed Playwright Chromium).
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';

const server=createServer((req,res)=>{
 req.headers.host='127.0.0.1:2000';
 preview.emit('request',req,res);
});
const preview=createPreviewServer({devPreview:true});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/clubs/it/1/overview',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
   await page.waitForFunction(()=>document.querySelector('.club-header [data-club-crest] .app-club-crest-image')?.complete);
   await page.evaluate(()=>{
    window.pageLoad02Crest=document.querySelector('.club-header [data-club-crest] .app-club-crest-image');
    window.pageLoad02Header=document.querySelector('.club-header');
   });
   for(const lang of ['de','es','fr','it','en']){
    await page.locator('.club-tabs [aria-current="page"]').focus();
    await page.evaluate(lang=>document.documentElement.lang=lang,lang);
    await page.waitForFunction(lang=>document.title.includes(window.faClubModel.copies[lang].overview),lang);
    const state=await page.evaluate(()=>({
     sameCrest:window.pageLoad02Crest===document.querySelector('.club-header [data-club-crest] .app-club-crest-image'),
     focused:document.activeElement?.matches('.club-tabs [aria-current="page"]'),
     tabs:document.querySelectorAll('.club-tabs a').length,
     overflow:document.documentElement.scrollWidth>innerWidth+2
    }));
    assert.equal(state.sameCrest,true,'loaded crest retained at '+width+' '+lang);
    assert.equal(state.focused,true,'focused tab retained at '+width+' '+lang);
    assert.equal(state.tabs,5);
    assert.equal(state.overflow,false);
   }
   // Locale changes deliberately translate the header wrapper. Compare the
   // current translated header across tab navigation, not its pre-locale node.
   await page.evaluate(()=>window.pageLoad02Header=document.querySelector('.club-header'));
   await page.locator('.club-tabs a[href*="/fixtures"]').click();
   await page.waitForURL('**/fixtures*');
   assert.equal(await page.evaluate(()=>window.pageLoad02Header===document.querySelector('.club-header')),true,'tab reuses same header');
   await page.goBack();
   await page.waitForURL('**/overview*');
   assert.equal(await page.evaluate(()=>window.pageLoad02Header===document.querySelector('.club-header')),true,'Back reuses same header');
   await page.goForward();
   await page.waitForURL('**/fixtures*');
   assert.equal(await page.evaluate(()=>window.pageLoad02Header===document.querySelector('.club-header')),true,'Forward reuses same header');
   await page.reload({waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
   assert.equal(await page.locator('.club-tabs a').count(),5,'hard refresh restores all club views');
   assert.deepEqual(errors,[],'no browser errors');
  }finally{await page.close()}
 }
 // Targeted P17/P18 C1/C3 audit. Hold manifest transport while observing
 // direct-navigation DOM; then release it and verify each view's actual content.
 const firstPaint=[];
 for(const view of ['overview','roster','fixtures','stats','history']){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  let release;
  const gate=new Promise(ok=>{release=ok});
  let requested=false;
  const intercept=async route=>{requested=true;await gate;await route.continue()};
  await page.route('**/clubs/_shared/manifest.json',intercept);
  try{
   await page.goto(origin+'/clubs/it/1/'+view,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.fa-shell-nav[data-nav01-static]')?.dataset.nav01Bound==='true');
   await page.waitForFunction(()=>window.faClubModel!==undefined);
   for(let i=0;i<100&&!requested;i++)await new Promise(ok=>setTimeout(ok,20));
   assert.equal(requested,true,'manifest intercepted for '+view);
   const pending=await page.evaluate(()=>({
    title:!!document.querySelector('#club-page .club-header h1'),
    tabs:document.querySelectorAll('#club-page .club-tabs a').length,
    sidebar:!!document.querySelector('.fa-shell-nav [aria-current="page"]'),
    error:!!document.querySelector('#club-page [role="alert"]'),
    ready:document.documentElement.dataset.clubReady==='true'
   }));
   assert.equal(pending.sidebar,true,'static nav at cold first paint '+view);
   assert.equal(pending.error,false,'pending transport is not an error '+view);
   assert.equal(pending.ready,false,'data is not accepted while manifest pending '+view);
   firstPaint.push({view,...pending});
   release();
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
   assert.equal(await page.locator('#club-page .club-header h1').count(),1,'hydrated title '+view);
   assert.equal(await page.locator('#club-page .club-tabs a').count(),5,'hydrated tabs '+view);
   assert.equal(await page.locator('#club-page .club-tabs a[aria-current="page"]').count(),1,'selected tab '+view);
  }finally{release();await page.unroute('**/clubs/_shared/manifest.json',intercept);await page.close()}
 }
 // A confirmed failed response must show error (not stale clubs) and the
 // subsequent successful refresh must recover without manual local state edits.
 {
  const page=await browser.newPage({viewport:{width:390,height:900}});
  const unavailable=route=>route.fulfill({status:503,contentType:'text/plain',body:'Unavailable'});
  await page.route('**/clubs/_shared/manifest.json',unavailable);
  try{
   await page.goto(origin+'/clubs/it/1/history',{waitUntil:'networkidle'});
   await page.locator('#club-page [role="alert"]').waitFor();
   assert.equal(await page.locator('#club-page .club-header').count(),0,'failed manifest must not expose stale club');
   await page.unroute('**/clubs/_shared/manifest.json',unavailable);
   await page.reload({waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
   assert.equal(await page.locator('#club-page .club-header').count(),1,'recover club header after 503');
   assert.equal(await page.locator('#club-page .club-tabs a').count(),5,'recover five tabs after 503');
  }finally{await page.unroute('**/clubs/_shared/manifest.json',unavailable);await page.close()}
 }
 console.log('PAGE_LOAD_02_CLUB_MANIFEST_EVIDENCE|'+JSON.stringify(firstPaint));
 console.log('PAGE-LOAD-02 Clubs C2/C3 browser PASS: Forward, hard reload, five delayed direct views, 503 recovery');
 console.log('PAGE-LOAD-02 club browser PASS: 4 widths, 5 locales, focus, crest reuse, navigation and Back');
}finally{
 await browser?.close();
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
}
