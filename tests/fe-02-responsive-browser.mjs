// FE-02: measured viewport geometry in the real loopback app, Chromium/WebKit.
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium,webkit} from "playwright";
const engine=process.env.FA_BROWSER_ENGINE||"chromium";
assert.ok(["chromium","webkit"].includes(engine));
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const profiles=[
 {width:320,height:700,language:"en",theme:"dark"},
 {width:390,height:844,language:"de",theme:"light"},
 {width:621,height:900,language:"fr",theme:"dark"},
 {width:768,height:900,language:"es",theme:"light"},
 {width:1159,height:900,language:"it",theme:"dark"},
 {width:1160,height:900,language:"en",theme:"light"},
 {width:1440,height:900,language:"de",theme:"dark"},
 {width:844,height:390,language:"fr",theme:"light"}
];
const checks=[];
async function visit(profile,path,verify){
 const context=await browser.newContext({
  viewport:{width:profile.width,height:profile.height},
  hasTouch:profile.width<=390,locale:profile.language,reducedMotion:"reduce"
 });
 await context.addInitScript(data=>{
  localStorage.setItem("football-architect:theme",data.theme);
  localStorage.setItem("football-architect:language",data.language);
 },profile);
 const page=await context.newPage(),errors=[];
 page.on("pageerror",error=>errors.push(String(error)));
 try{
  const response=await page.goto("http://app.localhost:2000"+path,{waitUntil:"domcontentloaded",timeout:30000});
  assert.equal(response?.status(),200,engine+" "+path);
  if(path.startsWith('/competitions/'))await page.waitForFunction(()=>!!window.faCompetitionContext?.definition);
  await verify(page);
  const overflow=await page.evaluate(()=>{
   const pane=document.querySelector(".fa-shell-content-scroll");
   const root=document.documentElement.scrollWidth-innerWidth;
   if(!pane)return {root,pane:0,paneShift:0,offenders:[]};
   const full=pane.scrollWidth-pane.clientWidth,original=pane.scrollLeft;
   pane.scrollLeft=10000;
   const shift=pane.scrollLeft-original;
   pane.scrollLeft=original;
   const bounds=pane.getBoundingClientRect();
   const offenders=full>2?Array.from(pane.querySelectorAll("*")).filter(el=>{
    if(el.closest(".app-world-standing-scroll,.app-competition-tabs,.language-menu"))return false;
    const r=el.getBoundingClientRect();
    return r.width>0&&r.right>bounds.right+1;
   }).slice(0,18).map(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {el:el.tagName.toLowerCase()+(el.id?"#"+el.id:"")+
     (typeof el.className==="string"?"."+el.className.trim().split(/\s+/).slice(0,3).join("."):""),
     right:Math.round(r.right),width:Math.round(r.width),minWidth:s.minWidth,
     overflowX:s.overflowX};
   }):[];
   return {root,pane:full,paneShift:shift,
    paneClient:pane.clientWidth,paneRect:bounds.width,
    gutter:getComputedStyle(pane).scrollbarGutter,offenders};
  });
  assert.ok(overflow.root<=2&&Math.abs(overflow.paneShift)<=2,
   "Unintended horizontal scroll "+JSON.stringify({profile,path,overflow}));
  assert.deepEqual(errors,[],engine+" "+path+" "+JSON.stringify(profile));
  checks.push({profile,path,overflow});
 }catch(error){
  mkdirSync("int24-browser-artifacts",{recursive:true});
  await page.screenshot({path:"int24-browser-artifacts/fe-02-"+engine+"-"+profile.width+"-"+path.replace(/[^a-z0-9]+/gi,"-")+".png",fullPage:true}).catch(()=>{});
  throw error;
 }finally{await context.close()}
}
try{
 for(const profile of profiles){
  await visit(profile,"/clubs",async page=>{
   const trigger=page.locator("#nav01-country-trigger");
   await page.waitForFunction(()=>!document.getElementById("nav01-country-trigger")?.disabled);
   await page.evaluate(()=>{
    const trigger=document.getElementById("nav01-country-trigger"),pane=document.querySelector(".fa-shell-content-scroll");
    pane.scrollTop+=trigger.getBoundingClientRect().bottom-pane.getBoundingClientRect().bottom+25;
   });
   await trigger.click();
   await page.waitForFunction(()=>!document.getElementById("nav01-country-menu").hidden&&
    !!document.getElementById("nav01-country-menu").dataset.menuPlacement);
   // A listbox can scroll its ancestor during open; sample after layout settles.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const observed=await page.evaluate(()=>{
    const pane=document.querySelector(".fa-shell-content-scroll").getBoundingClientRect();
    const menu=document.getElementById("nav01-country-menu").getBoundingClientRect();
    return {menu:[menu.top,menu.bottom],pane:[pane.top,pane.bottom],
     placement:document.getElementById("nav01-country-menu").dataset.menuPlacement,
     trigger:document.getElementById("nav01-country-trigger").getBoundingClientRect().top,
     appliedHeight:document.getElementById("nav01-country-menu").style.maxHeight,
     computedHeight:getComputedStyle(document.getElementById("nav01-country-menu")).maxHeight};
   });
   assert.ok(observed.menu[0]>=observed.pane[0]-2&&observed.menu[1]<=observed.pane[1]+2,
    "Menu must fit visible scroll pane "+JSON.stringify({profile,observed}));
   if(profile.width<=390){
    const height=await page.locator(".fa-shell-link").first().evaluate(e=>e.getBoundingClientRect().height);
    assert.ok(height>=43.9,"Sidebar mobile hit height "+height);
   }
  });
 }
 for(const profile of profiles.filter(p=>p.width<=390)){
  await visit(profile,"/calendar?calendarView=week",async page=>{
   await page.waitForFunction(()=>document.documentElement.dataset.calendarView==="week");
   const sizes=await page.evaluate(()=>["calendar-previous","calendar-next","calendar-week-trigger"].map(id=>{
    const r=document.getElementById(id).getBoundingClientRect();
    return {id,width:r.width,height:r.height,left:r.left,right:r.right};
   }));
   for(const value of sizes)assert.ok(value.height>=43.9,"Calendar touch "+JSON.stringify(value));
   const current=await page.locator("#calendar-current-week").boundingBox();
   if(current)assert.ok(sizes.at(-1).right<=current.x+2,"Week shortcut overlap");
   // Measure the optional shortcut in its reserved slot, even when the current week is selected.
   const weekLayout=await page.evaluate(()=>{
    const button=document.getElementById("calendar-current-week");button.hidden=false;
    const selector=document.getElementById("calendar-week-trigger").getBoundingClientRect();
    const current=button.getBoundingClientRect();
    const prev=document.getElementById("calendar-previous").getBoundingClientRect();
    const next=document.getElementById("calendar-next").getBoundingClientRect();
    const root=document.getElementById("calendar-controls").getBoundingClientRect();
    return {selector:[selector.left,selector.right,selector.top],current:[current.left,current.right,current.top],resetSquare:Math.abs(current.width-current.height)<=1&&current.height>=43.9,prev:[prev.left,prev.right],root:[root.left,root.right],nextRight:next.right,centerError:Math.abs(selector.left+selector.width/2-root.left-root.width/2)};
   });
   assert.ok(weekLayout.resetSquare&&weekLayout.nextRight<=weekLayout.current[0]-2 &&
     Math.abs(weekLayout.selector[2]-weekLayout.current[2])<=2 &&
     weekLayout.prev[0]>=weekLayout.root[0]-1 &&
     weekLayout.current[1]<=weekLayout.root[1]+1 &&
     weekLayout.centerError<=1,
     "Calendar Week selector must stay centered without overlapping Current week: "+JSON.stringify({profile,weekLayout}));
   const columns=async()=>page.evaluate(()=>{
    const row=[...document.querySelectorAll(".calendar-week-row")].find(row=>row.getClientRects().length);
    const tracks=getComputedStyle(row).gridTemplateColumns;
    return tracks.split(/\s+/).filter(Boolean).length;
   });
   assert.equal(await columns(),1,"Week view has one day column");
   await page.locator("#calendar-season").click();
   await page.waitForFunction(()=>document.documentElement.dataset.calendarView==="season");
   assert.equal(await columns(),7,"Season view retains the approved seven day columns");
   await page.locator("#calendar-week").click();
   await page.waitForFunction(()=>document.documentElement.dataset.calendarView==="week");
   assert.equal(await columns(),1,"Returning to Week restores a single column");
  });
  await visit(profile,"/competitions/it-1/standings",async page=>{
   const tab=page.locator("#competition-tab-standings");
   assert.ok((await tab.boundingBox()).height>=43.9,"Competition tab hit area");
  });
  await visit(profile,"/clubs/it/1/overview",async page=>{
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==="true");
   const tab=page.locator(".club-tabs .app-competition-tab").first();
   assert.ok((await tab.boundingBox()).height>=43.9,"Club tab hit area");
  });
 }
 // Same CSS/DOM class structure as live Fixtures; no sporting data mutation.
 for(const width of [621,768,800]){
  await visit({width,height:900,language:"en",theme:"dark"},"/competitions/it-1/fixtures",async page=>{
   await page.waitForFunction(()=>[...document.querySelectorAll('.app-fixture-club>.app-fixture-name.app-world-standing-club-link')].some(node=>node.getClientRects().length>0));
   const realClubs=await page.evaluate(()=>{
    const links=[...document.querySelectorAll(".app-fixture-club>.app-fixture-name.app-world-standing-club-link")].filter(el=>el.getClientRects().length);
    return {count:links.length,offenders:links.flatMap(el=>{
     const name=el.getBoundingClientRect(),club=el.closest(".app-fixture-club").getBoundingClientRect();
     return name.left>=club.left-1&&name.right<=club.right+1?[]:
      [{name:el.textContent?.trim(),nameRight:name.right,clubRight:club.right,nameLeft:name.left,clubLeft:club.left}];
    })};
   });
   assert.ok(realClubs.count>0&&realClubs.offenders.length===0,
    "Fixture team links must shrink inside club tracks: "+JSON.stringify({width,realClubs}));
   const value=await page.evaluate(()=>{
    const el=document.createElement("div");el.className="app-fixture-match";
    el.innerHTML='<div class="app-fixture-club app-fixture-home">Home United</div>'+
     '<div class="app-fixture-result"><div class="app-fixture-score">1 : 2</div>'+
     '<div class="app-fixture-stadium">Stadio Olimpico di Roma</div></div>'+
     '<div class="app-fixture-club">Away Athletic</div>';
    document.querySelector(".app-main").append(el);
    const rect=s=>el.querySelector(s).getBoundingClientRect();
    const stadium=rect(".app-fixture-stadium"),home=rect(".app-fixture-home");
    const away=rect(".app-fixture-club:not(.app-fixture-home)"),container=el.getBoundingClientRect();
    const line=el.querySelector(".app-fixture-stadium");
    const result={below:stadium.top>=Math.max(home.bottom,away.bottom)-1,
     contained:stadium.left>=container.left-1&&stadium.right<=container.right+1,
     singleLine:line.scrollWidth<=line.clientWidth+1};
    el.remove();return result;
   });
   assert.ok(value.below&&value.contained&&value.singleLine,
    "Tablet stadium "+JSON.stringify({width,value}));
  });
 }

 // SAF-01/02/03/04: mobile regressions on real loaded routes.
 for(const width of [320,390]){
  const profile={width,height:844,language:"it",theme:"dark"};
  await visit(profile,"/competitions/it-1/fixtures",async page=>{
   const geometry=await page.evaluate(()=>{
    const pane=document.querySelector(".fa-shell-content-scroll").getBoundingClientRect();
    const controls=[".app-fixtures-navigation","#app-fixtures-previous","#app-fixtures-round","#app-fixtures-next"].map(id=>{
     const r=document.querySelector("#competition-panel-fixtures "+id).getBoundingClientRect();
     return {left:r.left,right:r.right};
    });
    return {pane:{left:pane.left,right:pane.right},controls};
   });
   assert.ok(geometry.controls.every(r=>r.left>=geometry.pane.left-2&&r.right<=geometry.pane.right+2),
    "SAF-01 Fixtures must fit mobile content: "+JSON.stringify({width,geometry}));
   const measureControls=()=>page.evaluate(()=>{
    const current=document.getElementById("app-fixtures-current");
    const toolbar=document.querySelector("#competition-panel-fixtures .app-fixtures-toolbar");
    const navigation=toolbar.querySelector(".app-fixtures-navigation");
    const arrows=[...navigation.querySelectorAll(".app-fixtures-arrow")];
    const selector=navigation.querySelector(".app-fixtures-select");
    const pane=document.querySelector(".fa-shell-content-scroll").getBoundingClientRect();
    const wasHidden=current.hidden;
    const sample=()=>{
     const bar=toolbar.getBoundingClientRect(),nav=navigation.getBoundingClientRect();
     const button=current.getBoundingClientRect();
     return {barCenter:(bar.left+bar.right)/2,navCenter:(nav.left+nav.right)/2,
      navLeft:nav.left,navRight:nav.right,navTop:nav.top,
      buttonLeft:button.left,buttonRight:button.right,buttonTop:button.top,
      arrowWidths:arrows.map(x=>x.getBoundingClientRect().width),
      pickerWidth:selector.getBoundingClientRect().width};
    };
    current.hidden=false;const visible=sample();
    current.hidden=true;const hidden=sample();
    current.hidden=wasHidden;
    return {visible,hidden,pane:[pane.left,pane.right]};
   });
   const checkControls=(layout,label,maxPicker,maxArrow)=>{
    const {visible,hidden,pane}=layout;
    assert.ok(Math.abs(visible.navCenter-visible.barCenter)<=1&&
      Math.abs(hidden.navCenter-hidden.barCenter)<=1&&
      Math.abs(visible.navCenter-hidden.navCenter)<=1,
      "QA-02 V06 selector must stay truly centered with/without Reset: "+JSON.stringify({label,layout}));
    assert.ok(Math.abs(visible.buttonTop-visible.navTop)<=2&&
      visible.navRight<=visible.buttonLeft-2&&
      visible.navLeft>=pane[0]-2&&visible.buttonRight<=pane[1]+2,
      "QA-02 V06 Reset must fit alongside navigation: "+JSON.stringify({label,layout}));
    assert.ok(visible.pickerWidth<=maxPicker+1&&
      visible.arrowWidths.every(size=>size<=maxArrow+1),
      "QA-02 V06 compact picker/arrows: "+JSON.stringify({label,layout}));
   };
   const actionLayout=await measureControls();
   checkControls(actionLayout,width+"px",width<=360?118:132,width<=360?28:30);
   if(width===390){
    for(const desktop of [768,1440]){
     await page.setViewportSize({width:desktop,height:900});
     checkControls(await measureControls(),desktop+"px",168,32);
    }
    await page.setViewportSize({width,height:844});
   }
   // The restoration-complete marker is written only after the delayed
   // two-frame restorer has stopped ignoring user scroll events.
   await page.waitForFunction(()=>{
    const strip=document.querySelector(".app-competition-tabs");
    return document.documentElement.dataset.faTabsRestored==="true"&&
     strip&&strip.scrollWidth-strip.clientWidth>120;
   });
   await page.locator(".app-competition-tabs").evaluate(el=>{el.scrollLeft=120});
   const storageKey="football-architect:competition-tabs-scroll:/competitions/it-1";
   await page.waitForFunction(key=>{
    const strip=document.querySelector(".app-competition-tabs");
    return strip?.scrollLeft>65&&Number(sessionStorage.getItem(key))>65;
   },storageKey);
   await page.reload({waitUntil:"domcontentloaded"});
   // Assert persisted real position, not an intermediate first-paint zero.
   await page.waitForFunction(()=>document.querySelector(".app-competition-tabs")?.scrollLeft>65);
   const restored=await page.locator(".app-competition-tabs").evaluate(el=>el.scrollLeft);
   assert.ok(restored>65,"SAF-02 parser-time tab offset "+width+": "+restored);
  });
  await visit(profile,"/clubs/it/1/overview",async page=>{
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==="true");
   await page.locator(".club-tabs").evaluate(el=>{el.scrollLeft=80});
   await page.locator('.club-tabs a[href*="/fixtures"]').click();
   const offset=await page.locator(".club-tabs").evaluate(el=>el.scrollLeft);
   assert.ok(offset>40,"SAF-04 club tab offset must survive view switch: "+offset);
   assert.equal(await page.locator(".club-header-division").count(),0,"No obsolete league row in the header");
  });
  await visit(profile,"/clubs/it/1/overview",async page=>{
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==="true");
   const league=page.locator(".club-competition-name a[data-club-division-link]");
   assert.equal(await league.count(),1);
   await league.click();await page.waitForURL("**/competitions/it-1/standings**");
  });
 }
}finally{await browser.close()}
mkdirSync("int24-browser-artifacts",{recursive:true});
writeFileSync("int24-browser-artifacts/fe-02-"+engine+"-geometry.json",JSON.stringify({engine,checks},null,2));
console.log("FE-02 "+engine+" responsive PASS: "+checks.length+" route/viewport cases");
