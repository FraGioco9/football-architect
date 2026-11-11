// FE-01: same HEAD HTML/JS, exact PR-base CSS versus HEAD CSS; loopback only.
import {chromium} from "playwright";
import {execFileSync} from "node:child_process";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
import pixelmatch from "pixelmatch";
import {PNG} from "pngjs";
const base=process.env.PR_BASE_SHA;
assert.match(base||"",/^[0-9a-f]{40}$/);
const files=["assets/landing.css","assets/app.css","assets/account.css","assets/clubs-directory.css","assets/club-page.css","assets/competition-awards.css","assets/admin-settings.css"];
const changes=new Map();
for(const file of files){
 const older=execFileSync("git",["show",base+":"+file],{encoding:"utf8",maxBuffer:3e6});
 const newer=readFileSync(file,"utf8");
 if(older!==newer)changes.set("/"+file,{before:older,after:newer});
}
assert.ok(changes.size,"FE-01 CSS source was not changed");
// Authentication is intentionally redesigned in PR #478: its first-paint, typography,
// focus and interaction contracts are covered by the Account Chromium/WebKit matrices.
// Comparing those new controls with pre-redesign CSS would falsely enforce obsolete UI.
const routes=[
 {path:"/",site:true,selectors:[".site-header",".language-trigger",".cta"]},
 {path:"/guide/",site:true,selectors:[".site-header",".language-trigger",".guide-main"]},
 {path:"/dashboard",selectors:[".fa-shell-topbar",".app-panel",".app-link"]},
 {path:"/calendar",selectors:[".fa-shell-topbar",".calendar-season-picker .language-trigger",".calendar-arrow"]},
 {path:"/settings",selectors:[".fa-shell-topbar",".language-trigger",".app-panel"]},
 {path:"/competitions/it-1/standings",selectors:[".app-competition-header",".app-competition-tab",".app-competition-season .language-trigger"]},
 {path:"/competitions/int-1/fixtures",selectors:[".app-competition-header",".app-competition-tab",".app-fixtures-arrow"]},
 {path:"/clubs",selectors:[".nav01-filters>input",".nav01-filter .language-trigger",".nav01-card"]},
 // The Club page is intentionally redesigned in this PR. Its inner layout,
 // first paint, typography and mobile hit areas have dedicated Club QA.
 // FE-01 still checks the unchanged shell chrome on the Club route.
 {path:"/clubs/it/1/overview",selectors:[".fa-shell-topbar",".fa-shell-sidebar"]}
];
const profiles=[
 {width:320,theme:"dark",language:"en"},{width:390,theme:"light",language:"de"},
 {width:768,theme:"dark",language:"es"},{width:1440,theme:"light",language:"fr"},
 {width:390,theme:"dark",language:"it"},{width:320,theme:"light",language:"fr"},
 {width:768,theme:"light",language:"it"},{width:1440,theme:"dark",language:"en"}
];
const properties=["display","visibility","position","width","height","min-width","min-height","padding","gap","font-size","font-weight","line-height","color","background-color","border-color","border-width","border-radius","outline-color","outline-width","box-shadow","transition-duration","opacity","white-space","text-align"];
const browser=await chromium.launch({headless:true});
const findings=[],images=[];let checked=0;
try{
 for(const route of routes)for(const profile of profiles){
  const measure=async(stage)=>{
   const context=await browser.newContext({viewport:{width:profile.width,height:900},colorScheme:profile.theme,reducedMotion:"reduce"});
   await context.addInitScript(data=>{
    localStorage.setItem("football-architect:theme",data.theme);
    localStorage.setItem("football-architect:language",data.language);
   },{theme:profile.theme,language:profile.language});
   if(route.path.startsWith("/account/"))await context.route("**/api/player/session",req=>req.fulfill({status:401,contentType:"application/json",body:"{}"}));
   await context.route("**/*.css",request=>{
    const key=new URL(request.request().url()).pathname,change=changes.get(key);
    if(change)return request.fulfill({status:200,contentType:"text/css",body:change[stage]});
    return request.continue();
   });
   try{
    const page=await context.newPage();
    const origin=route.site?"http://localhost:2000":"http://app.localhost:2000";
    const response=await page.goto(origin+route.path,{waitUntil:"load",timeout:30000});
    if(route.path.startsWith("/account/")){
     await page.waitForFunction(()=>document.documentElement.dataset.accountReady==="true",null,{timeout:10000});
     // Account controls may be mounted/painted after the initial ready flag.
     // Compare only a genuinely visible input in both CSS baselines.
     await page.locator(route.selectors[0]).first().waitFor({state:"visible",timeout:10000});
    }
    assert.equal(response?.status(),200,route.path+" "+stage);
    if(route.path.startsWith('/competitions/'))await page.waitForFunction(()=>!!window.faCompetitionContext?.definition);
    if(route.path.startsWith('/clubs/')&&route.path!='/clubs')await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
    if(route.path==='/clubs')await page.waitForFunction(()=>!document.getElementById('nav01-country-trigger')?.disabled);
    await page.evaluate(async()=>{await document.fonts.ready});
    const collect=()=>page.evaluate(data=>{
     const result={};
     for(const selector of data.selectors){
      const elements=[...document.querySelectorAll(selector)].filter(el=>{
       const css=getComputedStyle(el);
       return css.display!=="none"&&css.visibility!=="hidden"&&el.getClientRects().length>0;
      }).slice(0,3);
      result[selector]=elements.map(el=>{
       const css=getComputedStyle(el),rect=el.getBoundingClientRect();
       return {css:Object.fromEntries(data.props.map(key=>[key,css.getPropertyValue(key)])),
        rect:[rect.x,rect.y,rect.width,rect.height].map(v=>Math.round(v*10)/10)};
      });
     }
     return result;
    },{selectors:route.selectors,props:properties});
    const regular=await collect(),target=page.locator(route.selectors[0]).first();
    let focused=null;
    if(await target.count()&&await target.isVisible()){
     await target.focus();
     // Sample after the reduced-motion focus transition has painted in both contexts.
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     focused=await collect();
    }
    const screenshot=route.path==="/"&&profile.width===390&&profile.theme==="light"
     ?await page.screenshot({animations:"disabled",clip:{x:0,y:0,width:390,height:96}}):null;
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    return {regular,focused,screenshot,overflow};
   }finally{await context.close()}
  };
  const a=await measure("before"),b=await measure("after");
  // FE-02 (#366) authorizes only mobile hit geometry, not theme, token or
  // unrelated positioning changes. The FE-02 browser suite tests new sizes.
  const comparable=(sample,updated)=>{
   const copy=structuredClone({regular:sample.regular,focused:sample.focused,overflow:sample.overflow});
   if(profile.width<=390){
    const ignore=new Set();
    if(route.path==="/calendar")ignore.add(".calendar-arrow");
    if(route.path.startsWith("/competitions/")){
     ignore.add(".app-competition-tab");ignore.add(".app-fixtures-arrow");
    }
    for(const key of ["regular","focused"]){
     const obj=copy[key];if(!obj)continue;
     for(const name of ignore){
      if(updated&&obj[name])for(const el of obj[name])assert.ok(el.rect[3]>=43.9,
       "FE-02 mobile hit height "+route.path+" "+name);
      delete obj[name];
     }
    }
   }
   return copy;
  };
  if(JSON.stringify(comparable(a,false))!==JSON.stringify(comparable(b,true)))
   findings.push({route:route.path,profile,before:{regular:a.regular,focused:a.focused,overflow:a.overflow},after:{regular:b.regular,focused:b.focused,overflow:b.overflow}});
  if(a.screenshot&&b.screenshot){
   const left=PNG.sync.read(a.screenshot),right=PNG.sync.read(b.screenshot);
   assert.deepEqual([left.width,left.height],[right.width,right.height]);
   const pixels=pixelmatch(left.data,right.data,null,left.width,left.height,{threshold:.1,includeAA:false});
   const allowed=Math.max(1,Math.floor(left.width*left.height*.0001));
   images.push({pixels,allowed});
   if(pixels>allowed){
    mkdirSync("int24-browser-artifacts",{recursive:true});
    writeFileSync("int24-browser-artifacts/fe-01-before.png",a.screenshot);
    writeFileSync("int24-browser-artifacts/fe-01-after.png",b.screenshot);
   }
  }
  checked++;
 }
}finally{await browser.close()}
mkdirSync("int24-browser-artifacts",{recursive:true});
writeFileSync("int24-browser-artifacts/fe-01-parity.json",JSON.stringify({base,changed:[...changes.keys()],checked,findings,images},null,2));
assert.deepEqual(findings,[],"FE-01 style/focus/geometry mismatches: "+findings.length);
assert.ok(images.length===1&&images.every(x=>x.pixels<=x.allowed),"FE-01 static screenshot parity");
console.log("FE-01 visual parity PASS: "+checked+" paired route/theme/width/locale cases");
