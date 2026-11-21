import {verifyCanonicalStateBrowser} from './canonical-state-browser.mjs';
import {webkit,devices} from "playwright";
import assert from "node:assert/strict";
import {runArea} from "./ci-opt-01-browser-smoke.mjs";
import {areaRoutes} from "./ci-opt-01-browser-cases.mjs";
import {createBrowserTiming} from '../tools/ci-browser-timing.mjs';
const origin="http://app.localhost:2000";
const timing=createBrowserTiming('webkit-iphone-pipeline','webkit');
const browser=await webkit.launch({headless:true});
timing.mark('browser-ready');
const pages=["/calendar","/competitions/it-1/standings","/clubs","/guide"];
const results=[];
try{
 await verifyCanonicalStateBrowser(browser,'webkit');
 timing.mark('canonical-state-complete');
 for(const area of Object.keys(areaRoutes)){
  await runArea(browser,area,"webkit");
  timing.mark('area-'+area+'-complete');
 }
 for(const route of pages){
  const contextStart=timing.now();
  const context=await browser.newContext({...devices["iPhone 13"],locale:"en-US"});
  try{
   const page=await context.newPage();
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   const response=await page.goto(origin+route,{waitUntil:"domcontentloaded",timeout:30000});
   assert.equal(response?.status(),200,route);
   if(route.startsWith('/competitions/'))await page.waitForFunction(()=>!!window.faCompetitionContext?.definition);
   if(route==='/clubs')await page.waitForFunction(()=>!document.getElementById('nav01-country-trigger')?.disabled);
   timing.sample('iphone-context-and-document-ready',timing.now()-contextStart);
   const state=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,body:!!document.body,theme:document.documentElement.dataset.theme||""}));
   assert.ok(state.body,route);
   assert.ok(state.scrollWidth<=state.width+2,route+" horizontal overflow: "+JSON.stringify(state));
   assert.deepEqual(errors,[],route+" errors");
   results.push({route,...state});
  }finally{await context.close()}
 }
 timing.mark('iphone-routes-complete');
}finally{
 try{await browser.close()}finally{timing.mark('cleanup-complete');timing.report();}
}
console.log("WebKit iPhone emulation PASS: "+results.length+" routes");
