// PAGE-LOAD-02 P17/P18: real-browser regression for club crest and focus reuse.
// Run: node tests/page-load-02-club-browser.mjs (requires installed Playwright Chromium).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

 // PAGE-LOAD-03A: inspect first-paint DOM while the manifest is held.
 const manifest=JSON.parse(readFileSync(new URL('../clubs/_shared/manifest.json',import.meta.url),'utf8'));
 for(const [country,id,view] of [['br',1,'overview'],['it',17,'roster'],['it',40,'fixtures'],['eng',33,'stats'],['br',40,'history']]){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  let release;const gate=new Promise(resolve=>release=resolve),handler=async route=>{await gate;await route.continue()};
  await page.route('**/clubs/_shared/manifest.json',handler);
  try{
   await page.goto(origin+'/clubs/'+country+'/'+id+'/'+view,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.documentElement.dataset.clubIdentityReady==='true');
   const identity=manifest.clubs.find(c=>c.countryId===country.toUpperCase()&&c.clubId===id);
   assert.ok(identity);
   const pending=await page.evaluate(()=>({
    title:document.querySelector('#club-title')?.textContent,
    place:document.querySelector('.club-header .club-location')?.textContent,
    tabs:[...document.querySelectorAll('#club-page > .club-tabs a')].map(a=>({href:a.getAttribute('href'),selected:a.getAttribute('aria-current')})),
    falseEmpty:!!document.querySelector('#club-page .club-empty p,#club-page .club-competition-next-empty'),
    error:!!document.querySelector('#club-page [role="alert"]'),
    ready:document.documentElement.dataset.clubReady==='true',
    visible:document.querySelector('#club-page > .club-header')?.getAttribute('aria-hidden')!=='true'
   }));
   assert.equal(pending.title,identity.fullName);
   assert.ok(pending.place.includes(identity.city));
   assert.equal(pending.tabs.length,5);
   assert.equal(pending.tabs.filter(tab=>tab.selected==='page').length,1);
   assert.equal(pending.tabs.find(tab=>tab.selected==='page').href,'/clubs/'+country+'/'+id+'/'+view);
   assert.equal(pending.falseEmpty,false);
   assert.equal(pending.error,false);assert.equal(pending.ready,false);assert.equal(pending.visible,true);
   await page.evaluate(()=>window.clubFirstPaintNodes={
    header:document.querySelector('#club-page > .club-header'),
    title:document.querySelector('#club-title'),
    tabs:document.querySelector('#club-page > .club-tabs'),
    crest:document.querySelector('.club-header .club-crest'),
    image:document.querySelector('.club-header .app-club-crest-image')
   });
   const flagName={it:'it',eng:'gb-eng',es:'es',de:'de',fr:'fr',pt:'pt',nl:'nl',br:'br'}[country];
   const flag=page.locator('.club-first-paint-flag img.club-country-flag');
   assert.equal(await flag.getAttribute('src'),'/assets/flags/'+flagName+'.svg','one country flag per Club');
   const flagBox=await flag.boundingBox();
   assert.ok(flagBox&&Math.abs(flagBox.width-25)<0.1&&Math.abs(flagBox.height-20)<0.1,'flag slot remains 25×20');
   const asset=manifest.clubCrests[country.toUpperCase()+'-'+id];
   if(asset)assert.equal(await page.locator('.club-header .app-club-crest-image').getAttribute('src'),'/'+asset);
   release();
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
   const final=await page.evaluate(()=>({
    header:window.clubFirstPaintNodes.header===document.querySelector('#club-page > .club-header'),
    title:window.clubFirstPaintNodes.title===document.querySelector('#club-title'),
    tabs:window.clubFirstPaintNodes.tabs===document.querySelector('#club-page > .club-tabs'),
    crest:window.clubFirstPaintNodes.crest===document.querySelector('.club-header .club-crest'),
    image:window.clubFirstPaintNodes.image===document.querySelector('.club-header .app-club-crest-image')
   }));
   assert.deepEqual(final,{header:true,title:true,tabs:true,crest:true,image:true},'preserve static nodes '+view);
  }finally{release();await page.unroute('**/clubs/_shared/manifest.json',handler);await page.close()}
 }
 // Failed, malformed and missing manifests preserve valid permanent identity and tabs.
 for(const mode of ['503','bad-json','empty-json']){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  const handler=route=>route.fulfill({status:mode==='503'?503:200,contentType:'application/json',
   body:mode==='503'?'unavailable':mode==='bad-json'?'{invalid':'{}'});
  await page.route('**/clubs/_shared/manifest.json',handler);
  try{
   await page.goto(origin+'/clubs/it/40/history',{waitUntil:'domcontentloaded'});
   await page.locator('#club-page [role="alert"]').waitFor();
   assert.equal(await page.locator('#club-page > .club-header').count(),1);
   assert.equal(await page.locator('#club-page > .club-tabs a').count(),5);
   assert.equal(await page.locator('#club-page .club-competition-next-empty').count(),0);
   await page.unroute('**/clubs/_shared/manifest.json',handler);
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
   assert.equal(await page.locator('#club-page [role="alert"]').count(),0);
  }finally{await page.unroute('**/clubs/_shared/manifest.json',handler);await page.close()}
 }
 console.log('PAGE-LOAD-03A P17/P18 PASS: manifest held, 5 views and 503/invalid/empty recovery');

 console.log('PAGE-LOAD-02 club browser PASS: 4 widths, 5 locales, focus, crest reuse, navigation and Back');
}finally{
 await browser?.close();
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
}
