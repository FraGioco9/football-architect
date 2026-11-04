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
   assert.deepEqual(errors,[],'no browser errors');
  }finally{await page.close()}
 }
 console.log('PAGE-LOAD-02 club browser PASS: 4 widths, 5 locales, focus, crest reuse, navigation and Back');
}finally{
 await browser?.close();
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
}
