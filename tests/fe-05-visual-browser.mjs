// FE-05: same-SHA screenshot and layout invariants, not PR-base golden approval.
// Do not commit a new golden from this output: #367 rendering changes must merge first.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import pixelmatch from 'pixelmatch';
import {PNG} from 'pngjs';
import {visualProfiles,visualOrigins,frameDrift,screenshotBudget} from './fe-05-visual-fixtures.mjs';

const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.match(head,/^[a-f\d]{40}$/);
const output='int24-browser-artifacts',results=[];
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const originFor=p=>p.site?visualOrigins.site:visualOrigins.app;
const nextFrame=async(page,selector)=>page.locator(selector).first().evaluate(el=>{
 const r=el.getBoundingClientRect(),s=getComputedStyle(el);
 return {x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,visibility:s.visibility,
  fontSize:s.fontSize,fontWeight:s.fontWeight,backgroundColor:s.backgroundColor,color:s.color,borderRadius:s.borderRadius};
});
const settled=async(page,config)=>{
 await page.locator(config.ready).first().waitFor({state:'visible',timeout:12000});
 if(config.path.startsWith('/account/'))await page.waitForFunction(()=>document.documentElement.dataset.accountReady==='true');
 if(config.path.startsWith('/clubs/it/'))await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true');
 await page.evaluate(async()=>{
  await document.fonts?.ready;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 });
};
const capture=async(page,config)=>{
 await settled(page,config);
 const frame=await nextFrame(page,config.frame);
 assert.ok(frame.width>0&&frame.height>0,config.id+' frame must occupy space');
 const pixels=await page.locator(config.frame).first().screenshot({animations:'disabled',caret:'hide',scale:'css',timeout:12000});
 return {frame,pixels};
};
function checkPixels(before,after){
 const a=PNG.sync.read(before),b=PNG.sync.read(after);
 assert.deepEqual([a.width,a.height],[b.width,b.height],'Pixel dimensions changed');
 const changed=pixelmatch(a.data,b.data,null,a.width,a.height,{threshold:0.1,includeAA:false});
 const allowed=screenshotBudget(a.width,a.height);
 return {changed,allowed,width:a.width,height:a.height};
}
async function fixtureContext(config){
 const ctx=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:1,
  colorScheme:config.theme,reducedMotion:'reduce',locale:config.language,hasTouch:config.width<=390});
 await ctx.addInitScript(({language,theme})=>{
  localStorage.setItem('football-architect:language',language);
  localStorage.setItem('football-architect:theme',theme);
 },config);
 // An account session is explicitly anonymous. No real credentials or remote service are used.
 await ctx.route('**/api/player/session',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await ctx.route('**/api/admin/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"unauthorized"}}'}));
 await ctx.route('**/api/player/permissions',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
 return ctx;
}
try{
 // Mutation proof for the real PNG/pixelmatch comparator, independent of layout CSS.
 const clean=new PNG({width:10,height:10});clean.data.fill(255);
 const damaged=new PNG({width:10,height:10});damaged.data.set(clean.data);damaged.data[0]=0;damaged.data[4]=0;
 const mutation=checkPixels(PNG.sync.write(clean),PNG.sync.write(damaged));
 assert.ok(mutation.changed>mutation.allowed,'A two-pixel regression must exceed the one-pixel budget');
 for(const config of visualProfiles){
  const context=await fixtureContext(config),page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const started=performance.now(),identity={head,scenario:config.id,path:config.path,viewport:config.width+'x'+config.height,language:config.language,theme:config.theme,engine:'chromium'};
  let before;
  try{
   const response=await page.goto(originFor(config)+config.path,{waitUntil:'load',timeout:30000});
   assert.equal(response?.status(),200,JSON.stringify(identity));
   before=await capture(page,config);
   if(config.tabs===7)assert.equal(await page.locator('.app-competition-tabs [role="tab"]').count(),7,config.id+' duplicate tabs');
   if(config.tabs===5)assert.equal(await page.locator('.club-tabs a').count(),5,config.id+' duplicate club views');
   if(config.path.includes('/competitions/')){
    assert.equal(await page.locator('#app-competition-season').count(),1,config.id+' duplicate season selector');
    assert.equal(new URL(page.url()).searchParams.get('season'),'1',config.id+' incorrect viewed season');
   }
   await page.reload({waitUntil:'load',timeout:30000});
   const after=await capture(page,config),drift=frameDrift(before.frame,after.frame),diff=checkPixels(before.pixels,after.pixels);
   assert.deepEqual(drift,[],JSON.stringify({...identity,drift}));
   assert.ok(diff.changed<=diff.allowed,JSON.stringify({...identity,diff}));
   assert.deepEqual(errors,[],JSON.stringify(identity));
   results.push({...identity,status:'PASS',diff,elapsedMs:Math.round(performance.now()-started)});
  }catch(error){
   mkdirSync(output,{recursive:true});
   const name=output+'/fe-05-'+config.id;
   if(before)writeFileSync(name+'-before.png',before.pixels);
   await page.screenshot({path:name+'-failure.png',fullPage:true,animations:'disabled'}).catch(()=>{});
   const evidence={...identity,status:'FAIL',message:String(error),url:page.url()};
   writeFileSync(name+'-failure.json',JSON.stringify(evidence,null,2));
   throw new Error('FE-05 '+JSON.stringify(evidence),{cause:error});
  }finally{await context.close()}
 }
 // Hold the deferred competition controller, proving structural DOM exists before hydration.
 // The prepaint visibility guard is intentional: assert structure, not a false visible paint.
 const cold=visualProfiles.find(v=>v.id==='standings');
 const firstContext=await fixtureContext(cold),firstPage=await firstContext.newPage();
 let unblock;const held=new Promise(resolve=>{unblock=resolve});
 let requestSeen;const blocked=new Promise(resolve=>{requestSeen=resolve});
 try{
  await firstContext.route('**/assets/competition-page.js',async route=>{
   requestSeen();await held;await route.continue();
  });
  await firstPage.goto(originFor(cold)+cold.path,{waitUntil:'commit',timeout:30000});
  await blocked;
  await firstPage.locator('#competition-tab-standings').waitFor({state:'attached',timeout:12000});
  const pre=await firstPage.evaluate(()=>({tabs:document.querySelectorAll('.app-competition-tabs [role="tab"]').length,
   season:document.querySelectorAll('#app-competition-season').length,headers:document.querySelectorAll('.app-competition-header').length}));
  assert.deepEqual(pre,{tabs:7,season:1,headers:1},'First-paint structure must precede controller hydration');
  unblock();await firstPage.waitForLoadState('load',{timeout:30000});await settled(firstPage,cold);
  assert.equal(await firstPage.locator('.app-competition-tabs [role="tab"]').count(),pre.tabs);
  assert.equal(await firstPage.locator('.app-competition-header').count(),pre.headers);
  results.push({head,scenario:'static-competition-pre-hydration',status:'PASS',path:cold.path,engine:'chromium'});
 }finally{unblock();await firstContext.close()}
 // One focused visual navigation test; existing SH-03/INT24 suites own season, source and stale-response semantics.
 const config=visualProfiles.find(v=>v.id==='standings'),ctx=await fixtureContext(config),page=await ctx.newPage();
 try{
  await page.goto(originFor(config)+config.path,{waitUntil:'load'});await settled(page,config);
  const tabs=page.locator('.app-competition-tabs'),initial=await nextFrame(page,config.frame);
  await page.locator('#competition-tab-fixtures').click();
  await page.waitForURL(url=>url.pathname.endsWith('/fixtures')&&url.searchParams.get('season')==='1');
  assert.equal(await page.locator('#competition-tab-fixtures').getAttribute('aria-selected'),'true');
  await page.goBack();await page.waitForURL(url=>url.pathname.endsWith('/standings')&&url.searchParams.get('season')==='1');
  assert.equal(await page.locator('#competition-tab-standings').getAttribute('aria-selected'),'true');
  await page.goForward();await page.waitForURL(url=>url.pathname.endsWith('/fixtures')&&url.searchParams.get('season')==='1');
  assert.equal(await page.locator('#competition-tab-fixtures').getAttribute('aria-selected'),'true');
  assert.equal(await tabs.count(),1,'Tabs must not be remounted twice');
  assert.ok((await nextFrame(page,config.frame)).width>=initial.width-1.5,'Tabs geometry changed after history navigation');
  results.push({head,scenario:'competition-history-navigation',status:'PASS',path:page.url(),engine:'chromium'});
 }finally{await ctx.close()}
 mkdirSync(output,{recursive:true});
 writeFileSync(output+'/fe-05-visual-results.json',JSON.stringify({head,results},null,2));
 console.log('FE-05 Chromium visual stability PASS: '+results.length+' scenarios, head '+head);
}finally{await browser.close()}
