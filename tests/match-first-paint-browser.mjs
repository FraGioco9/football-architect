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
     const main=el.closest('.app-match-page').getBoundingClientRect();
     return {width:rect.width,height:rect.height,
      x:rect.x,viewportWidth:innerWidth,
      separatorCenterOffset:(separator.x+separator.width/2)-(main.x+main.width/2),
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
     return [...grid.querySelectorAll('.app-match-team-link')].map((el,index)=>{
      const bar=el.querySelector('.app-skeleton-bar');
      const b=bar?.getBoundingClientRect(),label=el.getBoundingClientRect();
      return b?{width:b.width,height:b.height,
       toScore:index===0?label.right-b.right:b.left-label.left,
       justify:getComputedStyle(el).justifyContent,
       dy:(b.y+b.height/2)-(row.y+row.height/2)}:null;
     });
    });
    const isMobile=device.width<=480;
    for(const [i,s] of skeletons.entries()){
     assert.ok(s,JSON.stringify({engine,theme,device,skeletons}));
     assert.ok(Math.abs(s.width-(isMobile?50:54))<=0.5,JSON.stringify({engine,theme,device,skeletons}));
     assert.equal(s.height,isMobile?18:20);
     assert.equal(s.justify,i===0?'flex-end':'flex-start');
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
     return {nameScoreGaps,names:names.map(el=>{const rect=el.getBoundingClientRect(),style=getComputedStyle(el);return {
      align:style.textAlign,display:style.display,vertical:style.alignItems,justify:style.justifyContent,
      font:parseFloat(style.fontSize),fits:el.scrollWidth<=el.clientWidth+1,
      height:rect.height,centerOffset:(rect.y+rect.height/2)-(row.y+row.height/2)
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
     assert.equal(name.align,'center');assert.equal(name.display,'flex');assert.equal(name.vertical,'center');
     assert.equal(name.justify,i===0?'flex-end':'flex-start');
     assert.equal(name.font,isMobile?24:26);assert.equal(name.fits,true,JSON.stringify({engine,theme,device,layout}));
     assert.equal(name.height,48);assert.ok(Math.abs(name.centerOffset)<=0.5,JSON.stringify({engine,theme,device,layout}));
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
      homeParticipant:{clubId:'IT-1'},awayParticipant:{clubId:'IT-2'},
      // These are test-only, deliberately inconsistent stale goals. The
      // public controller must ignore them before a completed result.
      result:currentStatus==='completed'?{homeGoals:12,awayGoals:3}:{homeGoals:9,awayGoals:9}})
    }));
    for(const status of ['awaiting_participants','scheduled','in_progress','postponed','cancelled','completed']){
     currentStatus=status;
     const response=await page.goto('http://app.localhost:2000/matches/123',{waitUntil:'domcontentloaded'});
     assert.equal(response?.status(),200,engine+' '+theme+' '+status);
     await page.waitForFunction(()=>document.querySelector('[data-match-detail]')?.dataset.matchLoad==='ready');
     const state=await page.evaluate(()=>{
      const root=document.querySelector('[data-match-detail]');
      const get=selector=>root.querySelector(selector);
      const scores=['home','away'].map(side=>get('[data-match-'+side+'-score]'));
      const dash=get('.app-match-score-separator');
      const section=root.getBoundingClientRect(),sep=dash.getBoundingClientRect();
      return {text:[scores[0].textContent,scores[1].textContent,dash.textContent],
       hidden:scores.map(node=>node.getAttribute('aria-hidden')),
       centreOffset:(sep.left+sep.width/2)-(section.left+section.width/2)};
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
       const originalThickness=style.textDecorationThickness;
       const offset=style.textUnderlineOffset;
       const outer=el.getBoundingClientRect();
       el.style.textDecorationLine='none';
       const withoutUnderline=range.getBoundingClientRect();
       el.style.removeProperty('text-decoration-line');
       return {href:el.hasAttribute('href')?new URL(el.getAttribute('href'),location.href).pathname:null,underlined:originalDecoration,
        thickness:originalThickness,offset,
        outerHeight:outer.height,deltaX:withUnderline.x-withoutUnderline.x,
        deltaY:withUnderline.y-withoutUnderline.y,
        deltaWidth:withUnderline.width-withoutUnderline.width,
        deltaHeight:withUnderline.height-withoutUnderline.height};
      }));
      assert.deepEqual(linked.map(x=>x.href),['/clubs/it/1/overview','/clubs/it/2/overview']);
      for(const link of linked){
       assert.equal(link.underlined,'underline');
       assert.equal(link.thickness,'1px');assert.equal(link.offset,'3px');
       assert.equal(link.outerHeight,48);
       for(const k of ['deltaX','deltaY','deltaWidth','deltaHeight'])assert.ok(Math.abs(link[k])<=0.1,JSON.stringify({engine,theme,linked}));
      }
      const home=page.locator('[data-match-home-name]');
      await home.hover();
      assert.equal(await home.evaluate(el=>getComputedStyle(el).textDecorationLine),'underline');
      await home.click();
      await page.waitForURL(url=>url.pathname==='/clubs/it/1/overview');
     }
    }
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
}
console.log('MATCH FIRST PAINT PASS: '+count+' Chromium/WebKit × Dark/Light × desktop/mobile direct-load+refresh cases, plus real controller score-state QA');
