// #577 — Real Chromium / WebKit computed first-paint QA on the shared match shell.
// The HTML response uses the production parser-time renderer with a verified
// synthetic match identity; no real-world match data, remote DB or deploy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {applyPublishedMatchFirstPaint} from '../tools/match-first-paint.mjs';

const shell=readFileSync(new URL('../matches/_shared/index.html',import.meta.url),'utf8');
const match={schemaVersion:1,providerId:'authoritative-world',matchId:'123',
 season:1,competitionId:'IT-1',stageId:'league',round:1,day:1,
 provenance:{kind:'authoritative'}};
const decorated=applyPublishedMatchFirstPaint(shell,match,'123');
assert.ok(decorated.includes('data-fa-match-first-paint'));
assert.ok(decorated.indexOf('data-fa-match-first-paint')<decorated.indexOf('</head>'));
assert.ok(!shell.includes('data-fa-match-first-paint'));
const cases=[{width:1440,expectedWidth:284},{width:390,expectedWidth:268},{width:320,expectedWidth:268}];
const engines={chromium,webkit};
let count=0;
for(const [engine,driver] of Object.entries(engines)){
 const browser=await driver.launch({headless:true});
 try{
  for(const theme of ['dark','light'])for(const device of cases){
   const ctx=await browser.newContext({viewport:{width:device.width,height:844},reducedMotion:'reduce'});
   try{
    await ctx.addInitScript(mode=>{
     localStorage.setItem('football-architect:theme',mode);
    },theme);
    const page=await ctx.newPage();
    // Keep the real CSS, theme bootstrapping and other shell resources. Prevent
    // match hydration to measure what the browser paints BEFORE asynchronous data.
    await page.route('**/matches/123',route=>route.fulfill({status:200,contentType:'text/html',body:decorated}));
    await page.route('**/assets/match-detail.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
    const response=await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    const sample=async()=>page.locator('.app-match-scoreboard').evaluate(el=>{
     const image=el.querySelector('.app-match-competition-logo img');
     const tile=el.querySelector('.app-match-competition-logo');
     const rect=el.getBoundingClientRect();
     const box=tile.getBoundingClientRect();
     const art=image?.getBoundingClientRect();
     const css=getComputedStyle(el);
     const bar=getComputedStyle(el,'::before');
     const tileStyle=getComputedStyle(tile);
     const separator=el.querySelector('.app-match-score-separator').getBoundingClientRect();
     const mainEl=el.closest('#main-content'),main=mainEl.getBoundingClientRect();
     const mainCss=getComputedStyle(mainEl);
     const mainContentMid=(main.left+parseFloat(mainCss.paddingLeft)+main.right-parseFloat(mainCss.paddingRight))/2;
     const section=el.closest('.app-match-page').getBoundingClientRect();
     return {width:rect.width,height:rect.height,
      sectionFillsMain:Math.abs(section.left-(main.left+parseFloat(mainCss.paddingLeft)))<=0.5&&Math.abs(section.right-(main.right-parseFloat(mainCss.paddingRight)))<=0.5,
      x:rect.x,viewportWidth:innerWidth,
      separatorCenterOffset:(separator.x+separator.width/2)-mainContentMid,
      surface:css.getPropertyValue('--app-match-surface').trim(),
      barColour:bar.backgroundColor,
      mode:document.documentElement.dataset.theme,
      badgeTheme:el.dataset.scoreboardTheme,
      tile:{w:box.width,h:box.height,borderColour:tileStyle.borderTopColor},
      art:art?{w:art.width,h:art.height,dx:art.x+art.width/2-box.x-box.width/2,
       dy:art.y+art.height/2-box.y-box.height/2}:null};
    });
    const first=await sample();
    assert.equal(first.surface,'#155F50',JSON.stringify({engine,theme,device,first}));
    assert.equal(first.mode,theme,JSON.stringify({engine,theme,device,first}));
    assert.equal(first.height,48);
    assert.equal(await page.locator('.app-match-scoreboard-meta, [data-match-status], [data-match-extra]').count(),0,
     'no loading or sporting-status captions under the scoreboard');
    assert.equal(first.sectionFillsMain,true,'match section must share the main content width');
    assert.ok(Math.abs(first.separatorCenterOffset)<=0.5,JSON.stringify({engine,theme,device,first}));
    assert.ok(first.x>=-0.5,JSON.stringify({engine,theme,device,first}));
    assert.ok(first.x+first.width<=first.viewportWidth+0.5,JSON.stringify({engine,theme,device,first}));
    for(const selector of ['[data-match-home-score]','[data-match-away-score]'])
     assert.equal(await page.locator(selector).textContent(),'',selector+' must begin blank');
    assert.equal(await page.locator('.app-match-score-separator').textContent(),'–',
     'the centre dash remains visible before hydration');
    // The match section adds no artificial top space in either breakpoint.
    assert.equal(await page.locator('.app-match-page').evaluate(el=>getComputedStyle(el).paddingTop),'0px');
    // 268px is a maximum on narrow viewports: shell gutters can reduce the
    // available width at 320px without violating the fixed-layout contract.
    assert.ok(first.width<=device.expectedWidth+1,JSON.stringify({engine,theme,device,first}));
    if(device.width>=390)assert.ok(Math.abs(first.width-device.expectedWidth)<1,JSON.stringify({engine,theme,device,first}));
    else assert.ok(first.width>=250,JSON.stringify({engine,theme,device,first}));
    assert.equal(first.tile.w,48);assert.equal(first.tile.h,48);
    // Skeletons reserve a typographically proportional block centred on the
    // same two axes as the hydrated abbreviations, without a layout shift.
    const skeletons=await page.locator('.app-match-score-line').evaluate(grid=>{
     const row=grid.getBoundingClientRect();
     return [...grid.querySelectorAll('.app-match-team-slot')].map((cell,index)=>{
      const bar=cell.querySelector('.app-skeleton-bar');
      const b=bar?.getBoundingClientRect(),box=cell.getBoundingClientRect();
      return b?{width:b.width,height:b.height,
       toScore:index===0?box.right-b.right:b.left-box.left,
       justify:getComputedStyle(cell).justifyContent,
       cellHeight:box.height,
       dy:(b.y+b.height/2)-(row.y+row.height/2)}:null;
     });
    });
    const isMobile=device.width<=480;
    for(const [i,s] of skeletons.entries()){
     assert.ok(s,JSON.stringify({engine,theme,device,skeletons}));
     assert.ok(Math.abs(s.width-(isMobile?50:54))<=0.5,JSON.stringify({engine,theme,device,skeletons}));
     assert.equal(s.height,isMobile?18:20);
     assert.equal(s.justify,i===0?'flex-end':'flex-start');
     assert.equal(s.cellHeight,48);
     assert.ok(Math.abs(s.toScore-4)<=0.5&&Math.abs(s.dy)<=0.5,JSON.stringify({engine,theme,device,skeletons}));
    }
    // Two-digit result columns and centred official three-character
    // abbreviations stay inside the unchanged 48px-high scoreboard.
    await page.evaluate(()=>{
     document.querySelector('[data-match-home-name]').textContent='TRA';
     document.querySelector('[data-match-away-name]').textContent='UNI';
     document.querySelector('[data-match-home-score]').textContent='12';
     document.querySelector('[data-match-away-score]').textContent='34';
    });
    const layout=await page.locator('.app-match-score-line').evaluate(grid=>{
     const names=[grid.querySelector('[data-match-home-name]'),grid.querySelector('[data-match-away-name]')];
     const slots=[grid.querySelector('.app-match-team-home'),grid.querySelector('.app-match-team-away')];
     const scores=[grid.querySelector('[data-match-home-score]'),grid.querySelector('[data-match-away-score]')];
     const center=grid.querySelector('.app-match-score-separator');
     const row=grid.getBoundingClientRect();
     const [leftScore,rightScore]=scores.map(el=>el.getBoundingClientRect());
     const separatorBox=center.getBoundingClientRect();
     const rangeFor=el=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect()};
     const homeText=rangeFor(scores[0]),awayText=rangeFor(scores[1]),dashText=rangeFor(center);
     const separatorStyle=getComputedStyle(center);
     const nameText=names.map(el=>rangeFor(el));
     const nameScoreGaps={home:leftScore.left-nameText[0].right,away:nameText[1].left-rightScore.right};
     return {nameScoreGaps,names:names.map((el,i)=>{const rect=el.getBoundingClientRect(),style=getComputedStyle(el),slot=getComputedStyle(slots[i]);return {
      align:style.textAlign,display:style.display,vertical:slot.alignItems,justify:slot.justifyContent,
      font:parseFloat(style.fontSize),fits:el.scrollWidth<=el.clientWidth+1,
      height:rect.height,cellHeight:slots[i].getBoundingClientRect().height,
      centerOffset:(rect.y+rect.height/2)-(row.y+row.height/2)
     }}),
      scores:scores.map(el=>({width:el.getBoundingClientRect().width,text:el.textContent,align:getComputedStyle(el).textAlign})),
      dashStyle:{font:parseFloat(separatorStyle.fontSize),color:separatorStyle.color,opacity:separatorStyle.opacity},
      teamColor:getComputedStyle(names[0]).color,
      glyphGaps:{home:dashText.left-homeText.right,away:awayText.left-dashText.right},
      columnGap:getComputedStyle(grid).columnGap,
      scoreToDash:{left:separatorBox.left-leftScore.right,right:rightScore.left-separatorBox.right},
      separatorWidth:separatorBox.width,
      separator:center.textContent.trim(),height:grid.getBoundingClientRect().height};
    });
    for(const [i,name] of layout.names.entries()){
     // A flex item is blockified by CSS layout: inline-block specified on
     // the child anchor legitimately computes to block within its flex slot.
     // Its intrinsic text-sized box, not the computed display keyword,
     // determines the actual clickable area (asserted below).
     assert.equal(name.align,'center');assert.equal(name.display,'block');assert.equal(name.vertical,'center');
     assert.equal(name.justify,i===0?'flex-end':'flex-start');
     assert.equal(name.font,isMobile?24:26);assert.equal(name.fits,true,JSON.stringify({engine,theme,device,layout}));
     assert.equal(name.cellHeight,48);assert.ok(name.height<48);
     assert.ok(Math.abs(name.centerOffset)<=0.5,JSON.stringify({engine,theme,device,layout}));
    }
    for(const score of layout.scores){assert.ok(score.width>=(isMobile?32:35)-0.5);assert.equal(score.text.length,2);}
    assert.deepEqual(layout.scores.map(s=>s.align),['right','left']);
    // Each abbreviation has exactly its 4px edge inset; no unneeded
    // flexible whitespace remains between the name glyph and score track.
    assert.ok(layout.nameScoreGaps.home>=3.5&&layout.nameScoreGaps.home<=4.5,JSON.stringify({engine,theme,device,layout}));
    assert.ok(layout.nameScoreGaps.away>=3.5&&layout.nameScoreGaps.away<=4.5,JSON.stringify({engine,theme,device,layout}));
    assert.equal(layout.dashStyle.font,isMobile?19:21);
    assert.equal(layout.dashStyle.opacity,'1');
    if(theme==='dark')assert.equal(layout.dashStyle.color,'rgb(255, 255, 255)');
    else assert.equal(layout.dashStyle.color,layout.teamColor);
    assert.ok(layout.glyphGaps.home>=2&&layout.glyphGaps.away>=2,JSON.stringify({engine,theme,device,layout}));
    assert.equal(layout.columnGap,'0px');
    assert.ok(layout.separatorWidth>=(isMobile?18:20)-0.5,JSON.stringify({engine,theme,device,layout}));
    assert.ok(Math.abs(layout.scoreToDash.left)<=0.5&&Math.abs(layout.scoreToDash.right)<=0.5,JSON.stringify({engine,theme,device,layout}));
    assert.equal(layout.separator,'–');assert.equal(layout.height,48);
    assert.equal(first.badgeTheme,'competition');
    // The image is intentionally absent until the authorized match payload
    // arrives: the reserved badge itself must still be fully sized and centred.
    assert.equal(first.art,null);
    const light=theme==='light';
    assert.ok(first.barColour&&!['transparent','rgba(0, 0, 0, 0)'].includes(first.barColour));
    if(!light){
     assert.equal(first.barColour,'rgb(21, 95, 80)');
     assert.equal(first.tile.borderColour,'rgb(36, 48, 57)');
    }else{
     assert.notEqual(first.barColour,'rgb(36, 48, 57)');
     assert.equal(first.tile.borderColour,'rgb(21, 95, 80)');
    }
    // Render the real official SVG inside the reserved tile to verify the
    // final 44px artwork is precisely centred without changing box geometry.
    await page.evaluate(async()=>{
     const slot=document.querySelector('[data-match-competition-logo]');
     const img=document.createElement('img');
     img.width=44;img.height=44;img.alt='';
     img.src='/assets/divisions/it-1-lega-federale/compact.svg';
     slot.append(img);
     await img.decode();
    });
    const withImage=await sample();
    assert.ok(withImage.art,JSON.stringify({engine,theme,device}));
    assert.equal(withImage.art.w,44);assert.equal(withImage.art.h,44);
    assert.ok(Math.abs(withImage.art.dx)<=0.5,JSON.stringify({engine,theme,device,withImage}));
    assert.ok(Math.abs(withImage.art.dy)<=0.5,JSON.stringify({engine,theme,device,withImage}));
    // A refresh must begin on the correct competition colour, too.
    await page.reload({waitUntil:'domcontentloaded'});
    const second=await sample();
    assert.equal(second.surface,first.surface);
    assert.equal(second.barColour,first.barColour);
    assert.equal(second.mode,theme);
    assert.equal(second.badgeTheme,'competition');
    assert.equal(second.tile.borderColour,first.tile.borderColour);
    count++;
   }finally{await ctx.close()}
  }
  // Exercise the real match controller in a fresh document, not just the
  // first-paint shell. Stale scores supplied for non-completed statuses must
  // never display numbers or the centre dash.
  for(const theme of ['dark','light']){
   const ctx=await browser.newContext({viewport:{width:390,height:844}});
   try{
    await ctx.addInitScript(mode=>localStorage.setItem('football-architect:theme',mode),theme);
    const page=await ctx.newPage();
    let currentStatus='scheduled';
    await page.route('**/matches/123',route=>route.fulfill({
     status:200,contentType:'text/html',body:decorated
    }));
    await page.route('**/api/matches/123',route=>route.fulfill({
     status:200,contentType:'application/json',
     body:JSON.stringify({...match,status:currentStatus,
      homeParticipant:currentStatus==='awaiting_participants'?null:{clubId:'IT-1'},awayParticipant:{clubId:'IT-2'},
      // These are test-only, deliberately inconsistent stale goals. The
      // public controller must ignore them before a completed result.
      result:currentStatus==='completed'?{homeGoals:12,awayGoals:3}:{homeGoals:9,awayGoals:9}})
    }));
    for(const status of ['awaiting_participants','scheduled','in_progress','postponed','cancelled','completed']){
     currentStatus=status;
     const response=await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
     assert.equal(response?.status(),200,engine+' '+theme+' '+status);
     await page.waitForFunction(()=>document.querySelector('[data-match-detail]')?.dataset.matchLoad==='ready');
     assert.equal(await page.locator('.app-match-scoreboard-meta, [data-match-status], [data-match-extra]').count(),0,
      'no scheduled/playing/completed/extra-time caption should occupy the former line');
     if(status==='awaiting_participants'){
      const unresolved=page.locator('[data-match-home-name]');
      assert.equal(await unresolved.getAttribute('href'),null);
      assert.equal(await unresolved.getAttribute('target'),null);
      assert.equal(await unresolved.getAttribute('rel'),null);
     }
     const state=await page.evaluate(()=>{
      const root=document.querySelector('[data-match-detail]');
      const get=selector=>root.querySelector(selector);
      const scores=['home','away'].map(side=>get('[data-match-'+side+'-score]'));
      const dash=get('.app-match-score-separator');
      const main=root.closest('#main-content'),mainRect=main.getBoundingClientRect(),pad=getComputedStyle(main);
      const mainMid=(mainRect.left+parseFloat(pad.paddingLeft)+mainRect.right-parseFloat(pad.paddingRight))/2;
      const sep=dash.getBoundingClientRect();
      return {text:[scores[0].textContent,scores[1].textContent,dash.textContent],
       hidden:scores.map(node=>node.getAttribute('aria-hidden')),
       centreOffset:(sep.left+sep.width/2)-mainMid};
     });
     assert.deepEqual(state.text,status==='completed'?['12','3','–']:['','','–'],
      JSON.stringify({engine,theme,status,state}));
     assert.deepEqual(state.hidden,status==='completed'?['false','false']:['true','true']);
     assert.ok(Math.abs(state.centreOffset)<=0.5,JSON.stringify({engine,theme,status,state}));
     // Real authorised club IDs link to club pages even before a score
     // exists. Underlining must neither move text nor change on hover.
     if(status==='scheduled'){
      const links=page.locator('[data-match-home-name], [data-match-away-name]');
      const linked=await links.evaluateAll(nodes=>nodes.map(el=>{
       const style=getComputedStyle(el);
       const range=document.createRange();range.selectNodeContents(el);
       const withUnderline=range.getBoundingClientRect();
       const originalDecoration=style.textDecorationLine;
       const outer=el.getBoundingClientRect();
       const slot=el.parentElement.getBoundingClientRect();
       return {href:el.hasAttribute('href')?new URL(el.getAttribute('href'),location.href).pathname:null,
        underlined:originalDecoration,outerHeight:outer.height,
        slotHeight:slot.height,slotWidth:slot.width,linkWidth:outer.width,
        textWidth:withUnderline.width,
        dy:(outer.y+outer.height/2)-(slot.y+slot.height/2)};
      }));
      assert.deepEqual(linked.map(x=>x.href),['/clubs/it/1/overview','/clubs/it/2/overview']);
      for(const link of linked){
       assert.equal(link.underlined,'none');
       assert.equal(link.slotHeight,48);
       assert.ok(link.outerHeight<48&&link.linkWidth<link.slotWidth&&Math.abs(link.dy)<=0.5,
        JSON.stringify({engine,theme,linked}));
       assert.ok(Math.abs(link.textWidth-link.linkWidth)<=1,JSON.stringify({engine,theme,linked}));
      }
      const home=page.locator('[data-match-home-name]');
      const beforeHover=await home.evaluate(el=>({
       decoration:getComputedStyle(el).textDecorationLine,
       overflow:getComputedStyle(el).overflow,
       slotOverflow:getComputedStyle(el.parentElement).overflow,
       lineHeight:getComputedStyle(el).lineHeight,
       linkHeight:el.getBoundingClientRect().height,
       slotHeight:el.parentElement.getBoundingClientRect().height,
       verticalRoom:el.parentElement.getBoundingClientRect().bottom-el.getBoundingClientRect().bottom
      }));
      assert.equal(beforeHover.decoration,'none');
      assert.equal(beforeHover.overflow,'visible','the anchor must not clip underline glyph pixels');
      assert.equal(beforeHover.slotOverflow,'hidden','outer slot still contains off-column text');
      assert.ok(beforeHover.verticalRoom>=4,JSON.stringify({engine,theme,beforeHover}));
      const unhovered=await home.boundingBox();
      await home.hover();
      assert.equal(await home.evaluate(el=>getComputedStyle(el).textDecorationLine),'underline');
      const thickness=await home.evaluate(el=>getComputedStyle(el).textDecorationThickness);
      assert.ok(thickness==='.1em'||thickness==='0.1em'||Math.abs(parseFloat(thickness)-2.4)<0.15,
       JSON.stringify({engine,theme,thickness}));
      assert.equal(await home.evaluate(el=>getComputedStyle(el).textUnderlineOffset),'3px');
      const hovered=await home.boundingBox();
      for(const key of ['x','y','width','height'])assert.ok(Math.abs(hovered[key]-unhovered[key])<=0.5,
       JSON.stringify({engine,theme,key,hovered,unhovered}));
      // Empty regions in the 48px cell must neither hover nor navigate.
      const slot=await page.locator('.app-match-team-home').boundingBox();
      const outsideX=slot.x+3;
      const outsideY=slot.y+slot.height/2;
      assert.ok(outsideX<unhovered.x-1,JSON.stringify({engine,theme,slot,unhovered}));
      await page.mouse.move(outsideX,outsideY);
      assert.equal(await home.evaluate(el=>getComputedStyle(el).textDecorationLine),'none');
      await page.mouse.click(outsideX,outsideY);
      assert.equal(new URL(page.url()).pathname,'/matches/123');
      // Each real link must create a new tab without navigating the match
      // page. The competition tile is tested alongside both club labels.
      for(const item of [
       {link:page.locator('[data-match-competition-link]'),path:'/competitions/it-1/fixtures'},
       {link:home,path:'/clubs/it/1/overview'},
       {link:page.locator('[data-match-away-name]'),path:'/clubs/it/2/overview'}
      ]){
       const info=await item.link.evaluate(el=>({target:el.target,rel:el.rel,href:el.getAttribute('href')}));
       assert.equal(info.target,'_blank',JSON.stringify({engine,theme,info}));
       assert.ok(info.rel.split(/\s+/).includes('noopener')&&info.rel.split(/\s+/).includes('noreferrer'),
        JSON.stringify({engine,theme,info}));
       const popupReady=ctx.waitForEvent('page');
       await item.link.click();
       const newTab=await popupReady;
       await newTab.waitForURL(url=>url.pathname===item.path);
       assert.equal(new URL(page.url()).pathname,'/matches/123');
       await newTab.close();
      }
     }
    }
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
}
console.log('MATCH FIRST PAINT PASS: '+count+' Chromium/WebKit × Dark/Light × desktop/mobile direct-load+refresh cases, plus real controller score-state QA');
