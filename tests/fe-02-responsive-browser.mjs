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
  const response=await page.goto("http://app.localhost:2000"+path,{waitUntil:"networkidle",timeout:30000});
  assert.equal(response?.status(),200,engine+" "+path);
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
   const columns=async()=>page.evaluate(()=>{
    const tracks=getComputedStyle(document.querySelector(".calendar-week-row")).gridTemplateColumns;
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
}finally{await browser.close()}
mkdirSync("int24-browser-artifacts",{recursive:true});
writeFileSync("int24-browser-artifacts/fe-02-"+engine+"-geometry.json",JSON.stringify({engine,checks},null,2));
console.log("FE-02 "+engine+" responsive PASS: "+checks.length+" route/viewport cases");
