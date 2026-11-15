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
     return {width:rect.width,height:rect.height,
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
 }finally{await browser.close()}
}
console.log('MATCH FIRST PAINT PASS: '+count+' Chromium/WebKit × Dark/Light × desktop/mobile direct-load+refresh cases');
