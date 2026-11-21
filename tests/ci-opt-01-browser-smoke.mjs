import {verifyCompetitionPlayerStats} from './competition-player-stats-browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {browserCases,areaRoutes,verifyArea} from './ci-opt-01-browser-cases.mjs';
import {verifyCompetitionCompactNetwork} from './competition-compact-network-browser.mjs';
import {verifyCompetitionPublishedNetwork} from './competition-published-734-browser.mjs';
import {verifyClubBfcacheNetwork} from './club-api-bfcache-browser.mjs';
import {createBrowserTiming} from '../tools/ci-browser-timing.mjs';

export async function runArea(browser,area,engine='chromium'){
 assert.ok(Object.hasOwn(areaRoutes,area),'Unknown area');
 let checks=0;
 const timing=createBrowserTiming('browser-area-'+area,engine);
 try{
 for(const config of browserCases()){
  const {width,theme,language,touch}=config;
  const contextStart=timing.now();
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:touch,locale:language,reducedMotion:'reduce'});
  const page=await context.newPage();
  timing.sample('context-page-ready',timing.now()-contextStart);
  try{
   await context.addInitScript(({language,theme})=>{
    localStorage.setItem('football-architect:language',language);
    localStorage.setItem('football-architect:theme',theme);
    // Activate the protected DEV world explicitly for browser interaction QA.
    sessionStorage.setItem('football-architect:debug-enabled','on');
   },config);
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const navStart=timing.now();
   const response=await page.goto('http://app.localhost:2000'+areaRoutes[area],{waitUntil:'domcontentloaded',timeout:30000});
   timing.sample('navigation-domcontentloaded',timing.now()-navStart);
   assert.equal(response?.status(),200,area);
   const state=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,language:document.documentElement.lang,theme:document.documentElement.dataset.theme}));
   assert.ok(state.scroll<=state.width+2,JSON.stringify({area,config,state}));
   assert.equal(state.language,language,area+' language');
   assert.equal(state.theme,theme,area+' theme');
   const checkStart=timing.now();
   await verifyArea(page,area,config);
   timing.sample('interaction-and-readiness',timing.now()-checkStart);
   assert.deepEqual(errors,[],area+' JS errors');
   checks++;
  }catch(error){
   const out='int24-browser-artifacts';mkdirSync(out,{recursive:true});
   const name=out+'/targeted-'+engine+'-'+area+'-'+width+'-'+language+'-'+theme;
   await page.screenshot({path:name+'.png',fullPage:true}).catch(()=>{});
   writeFileSync(name+'.json',JSON.stringify({area,engine,config,url:page.url(),error:String(error)},null,2));
   throw error;
  }finally{const start=timing.now();try{await context.close()}finally{timing.sample('context-close',timing.now()-start)}}
 }
 timing.mark('pairwise-complete');
 if(area==='clubs'){const start=timing.now();checks+=await verifyClubBfcacheNetwork(browser,{engine});timing.sample('club-bfcache-network',timing.now()-start)}
 if(area==='competitions'){
  let start=timing.now();checks+=await verifyCompetitionCompactNetwork(browser,{engine});timing.sample('competition-compact-network',timing.now()-start);
  start=timing.now();checks+=await verifyCompetitionPlayerStats(browser,{engine});timing.sample('competition-player-stats',timing.now()-start);
  start=timing.now();checks+=await verifyCompetitionPublishedNetwork(browser,{engine});timing.sample('competition-published-network',timing.now()-start);
 }
 timing.mark('supplemental-complete');
 console.log('TARGETED '+engine+' PASS: '+area+' '+checks+' cases (pairwise widths/locales/themes; touch + keyboard)');
 return checks;
 }finally{timing.mark('suite-complete');timing.report();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const engine=process.env.FA_BROWSER_ENGINE||'chromium';
 assert.ok(['chromium','webkit'].includes(engine),'Unknown engine');
 const playwright=await import('playwright');
 const browser=await playwright[engine].launch({headless:true});
 try{await runArea(browser,process.env.FA_TARGET_AREA,engine)}finally{await browser.close()}
}
