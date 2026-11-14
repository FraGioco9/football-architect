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
   await page.goto(origin+'/clubs/it/1/overview',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.app-main')).paddingTop),
    '8px','Club page top padding remains 8px after hydration at '+width+'px');
   await page.waitForFunction(()=>document.querySelector('.club-header [data-club-crest] .app-club-crest-image')?.complete);
   await page.evaluate(()=>{
    window.pageLoad02Crest=document.querySelector('.club-header [data-club-crest] .app-club-crest-image');
    window.pageLoad02Header=document.querySelector('.club-header');
   });
   for(const lang of ['de','es','fr','it','en']){
    await page.locator('.club-tabs [aria-current="page"]').focus();
    await page.evaluate(lang=>document.documentElement.lang=lang,lang);
    await page.waitForFunction(()=>document.title===(document.querySelector('#club-title')?.textContent?.trim()||'Club')+' — Football Architect');
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
   await page.goto(origin+'/clubs/'+country+'/'+id+'/'+view+(view==='roster'?'?view=technical':''),{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.documentElement.dataset.clubShellReady==='true');
   if(view==='roster')assert.equal(new URL(page.url()).search,'','first paint strips a stale subview before the manifest resolves');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.app-main')).paddingTop),
    '8px','Club page top padding is 8px at first paint for '+view+' '+width+'px');
   const identity=manifest.clubs.find(c=>c.countryId===country.toUpperCase()&&c.clubId===id);
   assert.ok(identity);
   const pending=await page.evaluate(()=>({
    title:document.querySelector('#club-title')?.textContent,
     fallback:document.querySelector('#club-title [data-club-title-fallback]')?.textContent,
     hasNameSkeleton:!!document.querySelector('#club-title .club-fp-bar.club-fp-header-name'),
    place:document.querySelector('.club-header .club-location')?.textContent,
    tabs:[...document.querySelectorAll('#club-page > .club-tabs a')].map(a=>({href:a.getAttribute('href'),selected:a.getAttribute('aria-current')})),
    falseEmpty:!!document.querySelector('#club-page .club-empty p,#club-page .club-competition-next-empty'),
    error:!!document.querySelector('#club-page [role="alert"]'),
    ready:document.documentElement.dataset.clubReady==='true',
    visible:document.querySelector('#club-page > .club-header')?.getAttribute('aria-hidden')!=='true'
   }));
   assert.equal(pending.title,pending.fallback,'only the non-identifying accessible Club fallback is present before the catalog responds');
    assert.equal(pending.fallback,'Club','English first paint exposes a generic accessible club heading');
    assert.equal(pending.hasNameSkeleton,true,'visual club name remains a reserved skeleton until catalog responds');
   assert.equal(pending.place,'','city and country remain anonymous until catalog response');
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
   const flag=page.locator('.club-header .club-first-paint-flag');
   assert.equal(await page.locator('.club-header svg.club-country-flag').count(),0,'no club flag before catalog');
   const flagBox=await flag.boundingBox();
   assert.ok(flagBox&&Math.abs(flagBox.width-25)<0.1&&Math.abs(flagBox.height-20)<0.1,'reserved flag track 25×20');
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
    assert.equal(initial.totalBars,15,'competition logo slot and five text-value skeletons mirror the final membership row');
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
    const comp=await page.evaluate(()=>{
     const panel=document.querySelector('.club-fp-competition'),row=panel?.querySelector('.club-competition-entry');
     if(!row)return null;
     const rect=selector=>{const node=row.querySelector(selector),r=node?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null};
     return {availableWidth:parseFloat(getComputedStyle(panel.closest('.club-competition')).width),
       rowPadding:['Top','Right','Bottom','Left'].map(side=>parseFloat(getComputedStyle(row)['padding'+side])),
       row:row.getBoundingClientRect().toJSON(),
      identity:rect('.club-competition-identity'),logo:rect('.club-fp-competition-logo'),
      copy:rect('.club-competition-copy'),name:rect('.club-fp-competition-name'),
      tier:rect('.club-fp-competition-tier'),summary:(()=>{
       const a=rect('.club-competition-metrics'),b=rect('.club-competition-next');
       return {left:Math.min(a.left,b.left),right:Math.max(a.right,b.right),
        top:Math.min(a.top,b.top),bottom:Math.max(a.bottom,b.bottom)};
      })(),
      status:rect('.club-competition-metrics'),statusLabel:rect('.club-competition-metrics dt'),statusValue:rect('.club-competition-metrics dd'),
      statusBar:rect('.club-fp-competition-position'),
      next:rect('.club-competition-next'),nextContent:rect('.club-competition-next-content'),
      fixtureBar:rect('.club-fp-competition-fixture'),roundBar:rect('.club-fp-competition-round'),
       bottomSpacing:(()=>{
        const section=panel.closest('.club-competition');
        const style=getComputedStyle(section),box=section.getBoundingClientRect(),last=row.getBoundingClientRect();
        return {actual:box.bottom-last.bottom,
         expected:parseFloat(style.paddingBottom)+parseFloat(style.borderBottomWidth),
         minHeight:style.minHeight};
       })()};
    });
    assert.ok(comp&&Object.values(comp).every(Boolean),'first-paint competition has all final membership slots');
    assert.deepEqual(comp.rowPadding,[0,0,0,0],'competition rows are padding-free at first paint and all viewport widths');
     assert.ok(comp.bottomSpacing.minHeight==='0px'
      &&Math.abs(comp.bottomSpacing.actual-comp.bottomSpacing.expected)<1.5,
      'First-paint singleton Competitions ends at the original panel padding with no empty bottom strip at '+width+': '+JSON.stringify(comp.bottomSpacing));
    assert.ok(Math.abs(comp.name.left-comp.copy.left)<2&&Math.abs(comp.tier.left-comp.copy.left)<2,
     'name and tier skeletons begin exactly where hydrated league text begins');
    const centerX=r=>(r.left+r.right)/2;
    assert.ok(Math.abs(centerX(comp.statusBar)-centerX(comp.statusValue))<2
     &&Math.abs(centerX(comp.statusBar)-centerX(comp.statusLabel))<2
     &&Math.abs(comp.fixtureBar.left-comp.nextContent.left)<2,
     'Status skeleton centers on the hydrated value; Next match starts at the hydrated value origin');
    assert.ok(comp.logo.width===comp.logo.height&&Math.abs(comp.logo.width-(width<=760?44:60))<1,
     'anonymous division crest matches the singleton 60px desktop / 44px mobile size');
    // Compare singleton division and multi-membership identities in the same
    // panel at each viewport: number of rows must never change logo or font.
    const identityParity=await page.evaluate(()=>{
     const panel=document.querySelector('.club-competition');
     const list=panel.querySelector('.club-fp-competition');
     const logo=list.querySelector('.club-competition-logo');
     const name=list.querySelector('.club-competition-name');
     const sample=document.createElement('div');
     sample.className='club-competition-list';
     sample.style.cssText='position:absolute;left:-10000px;top:0;width:100%;pointer-events:none';
     sample.innerHTML='<div class="club-competition-layout club-competition-entry"><div class="club-competition-identity"><span class="club-competition-logo"></span><div class="club-competition-copy"><strong class="club-competition-name">Example league</strong></div></div></div>';
     panel.append(sample);
     const singletonLogo=sample.querySelector('.club-competition-logo').getBoundingClientRect();
     const singletonFont=parseFloat(getComputedStyle(sample.querySelector('.club-competition-name')).fontSize);
     const multiLogo=logo.getBoundingClientRect();
     const multiFont=parseFloat(getComputedStyle(name).fontSize);
     sample.remove();
     return {single:{width:singletonLogo.width,height:singletonLogo.height,font:singletonFont},
      multi:{width:multiLogo.width,height:multiLogo.height,font:multiFont}};
    });
    for(const dimension of ['width','height','font'])
     assert.ok(Math.abs(identityParity.single[dimension]-identityParity.multi[dimension])<.1,
      'one vs two competitions must have identical '+dimension+' at '+width+'px: '+JSON.stringify(identityParity));

    // Render Status and Next match in both real DOM layout classes. Measure
    // text sizes/line heights for two rows, including a missing next match.
    const summaryParity=await page.evaluate(()=>{
     const panel=document.querySelector('.club-competition');
     const probe=document.createElement('div');
     probe.style.cssText='position:absolute;left:-10000px;top:0;width:100%;pointer-events:none';
     const rowHtml=empty=>'<div class="club-competition-identity"><span class="club-competition-logo"></span>'+
      '<div class="club-competition-copy"><strong class="club-competition-name">International Cup</strong><span class="club-competition-tier">International</span></div></div>'+
      '<div class="club-competition-summary"><dl class="club-competition-metrics"><div><dt>Status</dt><dd>Group Stage</dd></div></dl>'+
      '<div class="club-competition-next"><span class="club-competition-label">Next match</span>'+
      '<div class="club-competition-next-content">'+(empty?'<span class="club-competition-next-empty">No upcoming match</span>':
       '<a class="app-link">Metropolitan Northumberland Athletic – Greater Westchester Borough</a><small>Matchday 5</small>')+
      '</div></div></div>';
     probe.innerHTML='<div class="club-competition-list"><div class="club-competition-layout club-competition-entry">'+rowHtml(false)+'</div></div>'+
      '<div class="club-competition-list"><div class="club-competition-layout club-competition-entry">'+rowHtml(true)+'</div></div>'+
      '<div class="club-competition-list"><div class="club-competition-layout club-competition-entry">'+rowHtml(false)+'</div>'+
      '<div class="club-competition-layout club-competition-entry">'+rowHtml(true)+'</div></div>';
     panel.append(probe);
     try{
      const rows=[...probe.children];
      const styles=row=>{
       const look=selector=>{
        const el=row.querySelector(selector),computed=getComputedStyle(el);
        return {size:parseFloat(computed.fontSize),line:parseFloat(computed.lineHeight),weight:computed.fontWeight};
       };
       return {
        statusLabel:look('.club-competition-metrics dt'),
        statusValue:look('.club-competition-metrics dd'),
        nextLabel:look('.club-competition-next>.club-competition-label'),
        nextValue:look('.club-competition-next-content>*'),
        round:row.querySelector('.club-competition-next small')?look('.club-competition-next small'):null
       };
      };
      return {single:rows.slice(0,2).map(list=>styles(list.firstElementChild)),
       multi:[...rows[2].children].map(styles)};
     }finally{probe.remove()}
    });
    for(let i=0;i<2;i++)for(const field of ['statusLabel','statusValue','nextLabel','nextValue','round']){
     const a=summaryParity.single[i][field],b=summaryParity.multi[i][field];
     if(a===null){assert.equal(b,null,'Round hidden in both layouts');continue}
     for(const key of ['size','line','weight'])assert.equal(b[key],a[key],
      'Status/Next match '+field+'.'+key+' must match singleton at '+width+'px, membership '+(i+1));
    }
    assert.equal(summaryParity.multi[0].statusValue.size,width<=760?19:24,
     'Status uses singleton large desktop/mobile value');
    assert.equal(summaryParity.multi[0].nextValue.size,width<=760?13:14,
     'Next match uses singleton desktop/mobile fixture size');

    assert.ok(comp.roundBar.top>comp.fixtureBar.top,'fixture round remains on the final secondary line');
    if(comp.availableWidth>800)assert.ok(comp.status.left>=comp.identity.right-2&&comp.next.left>=comp.status.right-2,
     'with space, status and next match stay grouped to the right');
    else assert.ok(comp.summary.top>=comp.identity.bottom-2&&comp.next.left>=comp.status.right-2,
     'in narrow panels, summary moves below identity but status and next remain side by side');
    assert.ok(comp.row.right<=width+1,'competition placeholder causes no viewport overflow');
    const mid=r=>(r.top+r.bottom)/2;
    assert.ok(Math.abs(mid(comp.status)-mid(comp.next))<1.5,
     'Status and Next match share the same vertical center at first paint');
    assert.ok(Math.abs(mid(comp.status)-mid(comp.summary))<1.5,
     'Status remains centered within the summary');
    if(comp.availableWidth>800){
     assert.ok(Math.abs(mid(comp.identity)-mid(comp.summary))<1.5,
      'wide competition row centers crest/name, Status and Next match together');
    }else{
     assert.ok(comp.summary.top>=comp.identity.bottom-1.5,
      'compact competition row centers the summary beneath the identity');
    }

    // Same row, two states: the parser-time skeleton and a verified membership
    // with long team names. Measure both before releasing the held manifest.
    const parity=await page.evaluate(()=>{
     const row=document.querySelector('.club-fp-competition .club-competition-entry'),initial=row.innerHTML;
     const list=row.closest('.club-competition-list'),initialListClass=list.className;
     const statusLabel=row.querySelector('.club-competition-metrics dt').textContent;
     const nextLabel=row.querySelector('.club-competition-next>.club-competition-label').textContent;
     const box=sel=>{const r=row.querySelector(sel).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
     const before={identity:box('.club-competition-identity'),logo:box('.club-competition-logo'),
      status:box('.club-competition-metrics dt'),next:box('.club-competition-next>.club-competition-label'),
      fixture:box('.club-fp-competition-fixture')};
     const states=[];
     try{
      // Hydration replaces the anonymous skeleton list with a verified list.
      // The first-paint and real fixture slots reserve the same minimum height,
      // so both the label and the fixture's first line retain their y position.
      list.classList.remove('club-fp-competition');
      // Verify the center of *visible* text, including the empty fixture state:
      // a reserved min-height used to make that text appear too high.
      for(const value of ['Group Stage','Gruppenphase','Fase de grupos','Phase de groupes','Quarts de finale','No upcoming match']){
       const empty=value==='No upcoming match';
       const fixture='Metropolitan Northumberland Athletic & Southwark International Football Club – Greater Westchester Borough Association & Port of South River United';
       const nextInfo=empty?'<span class="club-competition-next-empty">No upcoming match</span>':
        '<a class="app-link"><span class="club-competition-match-name">'+fixture+'</span></a><small>Matchday 5</small>';
       row.innerHTML='<div class="club-competition-identity"><span class="club-competition-logo"></span><div class="club-competition-copy"><strong class="club-competition-name"><a class="app-link">Sovereign Cup</a></strong><span class="club-competition-tier">International</span></div></div>'+
        '<div class="club-competition-summary"><dl class="club-competition-metrics"><div><dt>'+statusLabel+'</dt><dd data-club-position>'+(empty?'4th':value)+'</dd></div></dl>'+
        '<div class="club-competition-next"><span class="club-competition-label">'+nextLabel+'</span><div class="club-competition-next-content">'+nextInfo+'</div></div></div>';
       const dd=row.querySelector('.club-competition-metrics dd'),match=row.querySelector('.club-competition-match-name');
       const panel=row.closest('.club-competition').getBoundingClientRect();
       const summary=(()=>{
        const a=row.querySelector('.club-competition-metrics').getBoundingClientRect();
        const b=row.querySelector('.club-competition-next').getBoundingClientRect();
        return {left:Math.min(a.left,b.left),right:Math.max(a.right,b.right),
         top:Math.min(a.top,b.top),bottom:Math.max(a.bottom,b.bottom)};
       })();
       const label=row.querySelector('.club-competition-next>.club-competition-label').getBoundingClientRect();
       const nextContent=row.querySelector('.club-competition-next-content');
       const lastChild=nextContent.lastElementChild.getBoundingClientRect();
       const minHeight=getComputedStyle(nextContent).minHeight;
       const matchRect=match?.getBoundingClientRect();
       states.push({value,fixtureTop:box('.club-competition-next-content > *').y,identity:box('.club-competition-identity'),logo:box('.club-competition-logo'),
        status:box('.club-competition-metrics dt'),next:box('.club-competition-next>.club-competition-label'),
        statusBlock:box('.club-competition-metrics'),nextBlock:box('.club-competition-next'),
        summary:{x:summary.left,y:summary.top,width:summary.right-summary.left,height:summary.bottom-summary.top},visibleCenter:(label.top+lastChild.bottom)/2,minHeight,
        single:dd.scrollHeight<=parseFloat(getComputedStyle(dd).lineHeight)+1&&dd.scrollWidth<=dd.clientWidth+1,
        statusVisible:dd.scrollHeight<=dd.clientHeight+1&&dd.scrollWidth<=dd.clientWidth+1,
        visible:empty||match.scrollHeight<=match.clientHeight+1&&match.scrollWidth<=match.clientWidth+1,
        contained:summary.right<=panel.right+1&&(empty||matchRect.right<=panel.right+1),
        lineCount:empty?0:matchRect.height/parseFloat(getComputedStyle(match).lineHeight)});
      }
     }finally{row.innerHTML=initial;list.className=initialListClass}
     return {before,states};
    });
    for(const state of parity.states){
     for(const key of ['identity','logo','status','next'])
      assert.ok(Math.abs(state[key].x-parity.before[key].x)<1.5,
       'First paint '+key+' horizontal slot moved at '+width+'px: '+JSON.stringify({value:state.value,before:parity.before[key],after:state[key]}));
     // Both headings share a single grid track, including with wrapped values.
     assert.ok(Math.abs(state.status.y-state.next.y)<1.5,
      'Status and Next match labels must share the same row at '+width+'px: '+state.value);
     // A fixture with a visible match and secondary matchday line has the
     // same two-line shape as its first-paint bars, so its first-line y is fixed.
     // "No upcoming match" has only one visible line; it centers in the
     // reserved value track instead of pretending there is a matchday line.
     if(state.value!=='No upcoming match'&&state.lineCount<=1.1)
      assert.ok(Math.abs(state.fixtureTop-parity.before.fixture.y)<1.5,
       'First paint Next match first line moved for a one-line fixture plus matchday at '+width+'px for '+state.value);
     const centered=rect=>rect.y+rect.height/2;
     assert.ok(Math.abs(centered(state.statusBlock)-centered(state.nextBlock))<1.5,
      'Status and longer Next match are vertically centered on the same row at '+width+'px');
     assert.ok(Math.abs(centered(state.statusBlock)-centered(state.summary))<1.5,
      'Status remains centered within the grown row summary at '+width+'px');
     assert.equal(state.minHeight,'0px','Hydrated Next match does not reserve invisible height under its visible content at '+width+'px for '+state.value);
     if(comp.availableWidth>800)assert.ok(Math.abs(centered(state.identity)-centered(state.summary))<1.5,
      'wide row centers the crest/name and both summary blocks together at '+width+'px');
     assert.ok(state.visible&&state.contained,'Long fixture must wrap completely inside panel: '+JSON.stringify({width,...state}));
     assert.ok(state.statusVisible,'Localized Status must be fully visible without clipping at '+width+'px: '+state.value);
     if(comp.availableWidth>500&&state.value==='Group Stage')
      assert.ok(state.single,'Group Stage must fit on one line where the panel has space at '+width+'px');
    }
    assert.ok(parity.states[0].lineCount>=2,'long fixture names wrap rather than truncate');


    for(const field of ['nameLabel','city','country'])assert.equal(initial.values.find(x=>x.key===field)?.text,'','field remains empty before catalog: '+field);
   }
   const asset=manifest.clubCrests[country.toUpperCase()+'-'+id];
   assert.equal(await page.locator('.club-header .app-club-crest-image').count(),0,'no crest URL is loaded before catalog');
   release();
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
   const final=await page.evaluate(()=>({
    header:window.clubFirstPaintNodes.header===document.querySelector('#club-page > .club-header'),
    title:window.clubFirstPaintNodes.title===document.querySelector('#club-title'),
    tabs:window.clubFirstPaintNodes.tabs===document.querySelector('#club-page > .club-tabs'),
    crest:window.clubFirstPaintNodes.crest===document.querySelector('.club-header .club-crest'),
    image:window.clubFirstPaintNodes.image===document.querySelector('.club-header .app-club-crest-image')
   }));
   assert.equal(final.header,true,'preserve header node '+view);
   assert.equal(final.title,true,'preserve header title node '+view);
   assert.equal(final.tabs,true,'preserve tabs node '+view);
   assert.equal(final.crest,false,'replace anonymous crest slot with canonical crest on hydrate');
   assert.equal(await page.locator('#club-title').textContent(),identity.primaryName,'hydrate canonical primary name only from manifest');
    assert.equal(await page.title(),identity.primaryName+' — Football Architect','browser title uses canonical primary name');
   assert.ok((await page.locator('.club-header .club-location').textContent()).includes(identity.city),'hydrate city from manifest');
   if(asset)assert.equal(await page.locator('.club-header .app-club-crest-image').getAttribute('src'),'/'+asset);
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
 // Failed, malformed and missing manifests retain the skeleton shell and tabs, not guessed identities.
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
