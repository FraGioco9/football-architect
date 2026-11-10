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
 // The Overview color footprints must be identical before/after hydration
 // at the supported responsive widths, not just on the 390px baseline.
 for(const [country,id,view,width] of [
  ['br',1,'overview',320],['br',1,'overview',390],
  ['br',1,'overview',768],['br',1,'overview',1440],
  ['it',17,'roster',390],['it',40,'fixtures',390],
  ['eng',33,'stats',390],['br',40,'history',390]
 ]){
  const page=await browser.newPage({viewport:{width,height:900}});
  let release;const gate=new Promise(resolve=>release=resolve),handler=async route=>{
   await gate;
   // If another assertion closes the page while the manifest is blocked,
   // do not obscure the real failure with an unhandled late Route error.
   if(page.isClosed())return;
   try{await route.continue()}catch(error){
    if(!page.isClosed()&&!/Route is already handled|Target closed/i.test(String(error)))throw error;
   }
  };
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
   const flag=page.locator('.club-header svg.club-country-flag');
   assert.equal(await flag.count(),1,'one canonical header SVG');
   const flagBox=await flag.boundingBox();
   assert.ok(flagBox&&Math.abs(flagBox.width-25)<0.1&&Math.abs(flagBox.height-20)<0.1,'first-paint flag 25×20');
   const colorGeometry=()=>page.evaluate(()=>{
    const colors=document.querySelector('.club-identity .club-colors');
    if(!colors)return null;
    const row=colors.closest('dd').parentElement.getBoundingClientRect();
    const label=colors.closest('dd').previousElementSibling.getBoundingClientRect();
    const center=r=>(r.top+r.bottom)/2;
    return {
     labelDelta:center(colors.getBoundingClientRect())-center(label),
     labelGap:colors.getBoundingClientRect().top-label.bottom,
     pairs:[...colors.querySelectorAll('.club-color-value')].map(pair=>{
      const swatch=pair.querySelector('.club-color').getBoundingClientRect();
      const value=pair.lastElementChild.getBoundingClientRect();
      return {
       swatchX:swatch.left-row.left,swatchY:center(swatch)-row.top,
       valueX:value.left-row.left,valueY:center(value)-row.top,
       swatchWidth:swatch.width,swatchHeight:swatch.height
      };
     })
    };
   });
   let pendingColors=null;
   if(view==='overview'){
    assert.equal(await page.locator('.club-first-paint-overview .app-panel:visible').count(),3,'Overview cards visible before manifest');
    const initial=await page.evaluate(()=>{
     const panel=document.querySelector('.club-first-paint-overview'),facts=panel.querySelector('.club-identity .club-facts');
     return {
      labels:[...facts.querySelectorAll('dt')].map(x=>({text:x.textContent.trim(),bars:x.querySelectorAll('.club-fp-bar').length})),
      values:[...facts.querySelectorAll('[data-club-first-paint-value]')].map(x=>({key:x.dataset.clubFirstPaintValue,text:x.textContent.trim()})),
      totalBars:panel.querySelectorAll('.club-fp-bar').length,
      abbreviation:(()=>{const el=facts.querySelector('.club-fp-abbr');return el?el.getBoundingClientRect().width:null})(),
      colors:(()=>{const wrap=facts.querySelector('.club-fp-colors');return wrap?{swatches:[...wrap.querySelectorAll('.club-fp-color-swatch')].map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})),hex:[...wrap.querySelectorAll('.club-fp-hex')].map(x=>x.getBoundingClientRect().width)}:null})(),
      kitBars:panel.querySelectorAll('.club-kits .club-fp-bar').length,
      kits:panel.querySelector('.club-kits p')?.textContent.trim(),
      status:panel.querySelector('[data-club-first-paint-label="statusLabel"]')?.textContent.trim(),
      next:panel.querySelector('[data-club-first-paint-label="nextMatchLabel"]')?.textContent.trim()
     };
    });
    assert.equal(initial.labels.length,9,'all labels appear before API');
    assert.ok(initial.labels.every(x=>x.text.length>0&&x.bars===0),'no skeleton for a label');
    assert.equal(initial.totalBars,10,'skeletons only for fetched text and HEX values');
    assert.ok(initial.abbreviation>10&&initial.abbreviation<45,'abbreviation skeleton predicts three characters');
    assert.equal(initial.colors?.swatches.length,2,'two expected color boxes');
    assert.ok(initial.colors.swatches.every(({width,height})=>Math.abs(width-20)<0.1&&Math.abs(height-20)<0.1),'color swatches are 20×20px');
    assert.equal(initial.colors.hex.length,2,'one HEX value placeholder per color');
    assert.ok(initial.colors.hex.every(width=>width>35&&width<90),'HEX value placeholder predicts seven characters');
    pendingColors=await colorGeometry();
    assert.equal(pendingColors?.pairs.length,2,'both first-paint color boxes are present');
    assert.ok(width<=360?pendingColors.labelGap>=-1:Math.abs(pendingColors.labelDelta)<1,
     'color placeholders follow the label on narrow screens and center beside it otherwise');
    assert.ok(pendingColors.pairs.every(pair=>Math.abs(pair.valueY-pair.swatchY)<1),'each placeholder HEX is centered beside its swatch');
    assert.equal(initial.kitBars,0,'static kit text has no skeleton');
    assert.ok(initial.kits?.length>0&&initial.status?.length>0&&initial.next?.length>0,'static panel texts visible');
    assert.equal(initial.values.find(x=>x.key==='nameLabel')?.text,identity.primaryName);
    assert.equal(initial.values.find(x=>x.key==='city')?.text,identity.city);
    assert.ok(initial.values.find(x=>x.key==='country')?.text.length>0);
   }
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
   if(view==='overview'){
    const hydratedColors=await colorGeometry();
    assert.equal(hydratedColors?.pairs.length,2,'both hydrated club colors are present');
    assert.ok(width<=360?hydratedColors.labelGap>=-1:Math.abs(hydratedColors.labelDelta)<1,
     'hydrated colors follow the label on narrow screens and center beside it otherwise');
    for(let i=0;i<2;i++){
     const before=pendingColors.pairs[i],after=hydratedColors.pairs[i];
     for(const property of ['swatchX','swatchY','valueX','valueY','swatchWidth','swatchHeight'])
      assert.ok(Math.abs(before[property]-after[property])<1,
       'Color '+(i+1)+' '+property+' moved during hydration at '+width+'px: '+before[property]+' -> '+after[property]);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,
     'No page overflow from reserved color geometry at '+width+'px');
    const afterBox=await page.locator('.club-header svg.club-country-flag').boundingBox();
    assert.ok(afterBox&&Math.abs(afterBox.width-25)<0.1&&Math.abs(afterBox.height-20)<0.1,'same flag after hydration');
   }
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
