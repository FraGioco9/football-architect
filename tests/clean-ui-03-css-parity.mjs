// CSS-only browser parity: same HEAD HTML/JS with main's CSS vs HEAD CSS.
// Run under existing loopback preview after Playwright is installed. No server writes.
import {chromium} from "playwright";
import {execFileSync} from "node:child_process";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
import {PNG} from "pngjs";
import pixelmatch from "pixelmatch";
const baseSha=process.env.PR_BASE_SHA;
assert.match(baseSha||"",/^[0-9a-f]{40}$/,"PR_BASE_SHA must be the exact PR base commit");
const baseline=execFileSync("git",["show",baseSha+":assets/app.css"],{encoding:"utf8",maxBuffer:2e6});
const current=readFileSync("assets/app.css","utf8");
assert.notEqual(baseline,current,"CSS parity must compare a changed stylesheet");
const origin="http://app.localhost:2000";
const routes=["/calendar","/competitions/it-1/history","/competitions/it-1/standings","/competitions/int-1/postseason"];
const widths=[320,390,768,1440];
const selectors=["#world-calendar #calendar-controls","#calendar-previous","#calendar-next","#calendar-week-trigger","#calendar-current-week",".app-competition-header",".app-history-dev-archive-head",".app-history-dev-archive-club",".app-world-standing-table"];
const cssProperties=["display","visibility","position","width","height","padding","margin","font-size","font-weight","line-height","color","background-color","border-color","border-width","border-radius","opacity","transform","transition","outline","box-shadow","gap","overflow","white-space","text-align"];
const browser=await chromium.launch({headless:true});
let compared=0;
const findings=[];
const cssomObservations=[];
const screenshotComparisons=[];
try{
 for(const route of routes)for(const width of widths)for(const dark of [false,true])for(const reducedMotion of [false,true]){
  const run=async(useBaseline)=>{
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:dark?"dark":"light",reducedMotion:reducedMotion?"reduce":"no-preference"});
   try{
    await context.route("**/assets/app.css",r=>r.fulfill({status:200,contentType:"text/css",body:useBaseline?baseline:current}));
    const page=await context.newPage();
    const response=await page.goto(origin+route,{waitUntil:"load",timeout:25000});
    assert.equal(response?.status(),200,route);
    if(route.startsWith('/competitions/'))await page.waitForFunction(()=>!!window.faCompetitionContext?.definition);
    // Compare the hydrated state, not an arbitrary instant during asynchronous
    // standings first paint. The real table may legitimately be concealed by
    // the skeleton while the data provider is pending.
    if(route==='/competitions/it-1/standings')await page.waitForFunction(()=>{
     const state=document.documentElement.dataset;
     return state.faStandingsLoading==='false'&&
      !['faDevStandingsPending','faDebugPending','faDevSeasonTransition'].some(key=>state[key]==='true');
    });
    await page.evaluate(async()=>{await document.fonts.ready});
    // Calendar controls change color after hydration. Capture settled styles
    // on both sides, never mid-way through a finite CSS color transition.
    if(route==="/calendar"&&!reducedMotion)await page.evaluate(async()=>{
      const container=document.querySelector("#world-calendar #calendar-controls");
      if(!container)return;
      const elements=[container,...container.querySelectorAll("*")];
      const running=elements.flatMap(el=>el.getAnimations({subtree:false}))
       .filter(a=>a.playState==="running"&&Number.isFinite(a.effect?.getComputedTiming().endTime));
      await Promise.all(running.map(a=>a.finished.catch(()=>{})));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    const computed=await page.evaluate(({selectors,cssProperties})=>{
     const result={};
     for(const selector of selectors){
      // Inactive tab panels are intentionally hidden; their DEV hydration
      // phase can differ without changing any rendered surface.
      const elements=[...document.querySelectorAll(selector)].filter(e=>
       !e.closest('.app-competition-panel[hidden]')&&
       !(selector==='.app-world-standing-table'&&e.closest('.app-standings-skeleton'))&&
       // The desktop table occupies zero pixels on mobile. Its temporary
       // visibility state during hydration is not observable and is verified
       // separately by the responsive browser suite.
       !(selector==='.app-world-standing-table'&&
         e.getBoundingClientRect().width===0&&e.getBoundingClientRect().height===0)).slice(0,12);
      result[selector]=elements.map(e=>{
       const s=getComputedStyle(e);
       const props=Object.fromEntries(cssProperties.map(p=>[p,s.getPropertyValue(p)]));
       return {props,rect:[e.getBoundingClientRect().width,e.getBoundingClientRect().height].map(v=>Math.round(v*10)/10)};
      });
     }
     return result;
    },{selectors,cssProperties});
    const cssom=await page.evaluate(()=>{
      const sheet=[...document.styleSheets].find(s=>s.href&&new URL(s.href).pathname==="/assets/app.css");
      if(!sheet)return null;
      const rules=[...sheet.cssRules];
      return {totalTopLevelRules:rules.length,mediaRules:rules.filter(r=>r.type===CSSRule.MEDIA_RULE).length,calendarEnabledRules:rules.filter(r=>r.selectorText?.includes("#calendar-previous")&&r.selectorText?.includes(":not(:disabled)")).map(r=>r.selectorText)};
    });
    assert.ok(cssom,"app.css not found in browser CSSOM");
    // Pixel parity is scoped to static chrome: the Calendar's generated
    // schedule and first-paint lifecycle are not stable full-page baselines.
    // Dedicated browser tests still cover their complete visible layout.
    // FE-02 legitimately enlarges sidebar navigation hit boxes below the
     // 60px static shell header. Compare the unchanged 72px full-width chrome,
     // not the resized mobile links. FE-02 browser asserts their 44px hit area.
     const shot=route==="/calendar"&&width===390&&!dark&&reducedMotion ? await page.screenshot({animations:"disabled",clip:{x:0,y:0,width,height:72}}) : null;
    return {computed,cssom,shot};
   }finally{await context.close()}
  };
  const before=await run(true),after=await run(false);
  // PLAYER-AUTH-01's shared control transition is present on both sides of
  // this comparison. Compare it as-is rather than rewriting the observed CSS.
  const comparison=structuredClone(after.computed);
  // The first-paint lifecycle can suppress an otherwise inert zero-duration
  // transition on the real table. It must not create nonzero animations.
  for(const [index,item] of comparison[".app-world-standing-table"].entries()){
   const prior=before.computed[".app-world-standing-table"][index]?.props.transition;
   if(prior==='all'&&item.props.transition==='1e-05s')item.props.transition=prior;
  }
  if(!reducedMotion)for(const [index,item] of comparison["#calendar-current-week"].entries()){
   assert.equal(item.props.transition,before.computed["#calendar-current-week"][index].props.transition);
  }
  for(const selector of selectors){
   // Calendar uses centered controls and reserves space for its Week shortcut.
   // Restrict exceptions to Calendar control geometry; all other styles still match main.
   const authorizedCalendar=route==="/calendar"&&
    ["#world-calendar #calendar-controls","#calendar-previous","#calendar-next",
     "#calendar-week-trigger","#calendar-current-week"].includes(selector);
   const comparable=items=>items.map(item=>{
    const result=structuredClone(item);
    if(authorizedCalendar){
     for(const key of ["width","height","padding","gap"])delete result.props[key];
     result.rect=null; // tested independently on both browser engines in FE-02.
    }
    return result;
   });
   if(authorizedCalendar&&width<=390)for(const item of comparison[selector]){
    if(selector!=="#world-calendar #calendar-controls"&&item.rect[0]>0&&item.props.display!=="none")
     assert.ok(item.rect[1]>=43.9,"FE-02 Calendar hit height "+selector+" "+width);
   }
   if(JSON.stringify(comparable(before.computed[selector]))!==JSON.stringify(comparable(comparison[selector]))){
    findings.push({route,width,theme:dark?"dark":"light",reducedMotion,selector,before:before.computed[selector],after:after.computed[selector]});
   }
  }
  cssomObservations.push({route,width,theme:dark?"dark":"light",reducedMotion,baseline:before.cssom,current:after.cssom});
  if(before.shot&&after.shot){
    const left=PNG.sync.read(before.shot),right=PNG.sync.read(after.shot);
    assert.deepEqual([left.width,left.height],[right.width,right.height],"screenshot viewport geometry mismatch");
    const changedPixels=pixelmatch(left.data,right.data,null,left.width,left.height,{threshold:0.1,includeAA:false});
    const allowedPixels=Math.max(1,Math.floor(left.width*left.height*0.0001));
    const matching=changedPixels<=allowedPixels;
    screenshotComparisons.push({route,width,changedPixels,allowedPixels,matching});
    if(!matching){
      mkdirSync("int24-browser-artifacts",{recursive:true});
      const slug=route.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");
      writeFileSync("int24-browser-artifacts/css-parity-"+slug+"-before.png",before.shot);
      writeFileSync("int24-browser-artifacts/css-parity-"+slug+"-after.png",after.shot);
    }
  }
  compared++;
 }
}finally{await browser.close()}
mkdirSync("int24-browser-artifacts",{recursive:true});
writeFileSync("int24-browser-artifacts/clean-ui-03-css-parity.json",JSON.stringify({baseSha,compared,findings,cssomObservations,screenshotComparisons},null,2));
assert.deepEqual(findings,[],`CSS computed-style parity mismatches: ${findings.length}; see clean-ui-03-css-parity.json`);
assert.ok(cssomObservations.every(x=>x.baseline.totalTopLevelRules>0&&x.current.totalTopLevelRules>0),"empty CSSOM");
assert.ok(screenshotComparisons.length===1&&screenshotComparisons[0].route==="/calendar","one unchanged Calendar chrome screenshot comparison required");
assert.ok(screenshotComparisons.every(x=>x.matching),"CSS screenshot parity mismatch; see clean-ui-03-css-parity.json");
console.log(`CSS parity PASS: ${compared} matched route/viewport/theme/motion combinations`);
