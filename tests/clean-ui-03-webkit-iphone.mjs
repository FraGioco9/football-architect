import {webkit,devices} from "playwright";
import assert from "node:assert/strict";
const origin="http://app.localhost:2000";
const browser=await webkit.launch({headless:true});
const pages=["/calendar","/competitions/it-1/standings","/clubs","/guide"];
const results=[];
try{
 for(const route of pages){
  const context=await browser.newContext({...devices["iPhone 13"],locale:"en-US"});
  try{
   const page=await context.newPage();
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   const response=await page.goto(origin+route,{waitUntil:"networkidle",timeout:30000});
   assert.equal(response?.status(),200,route);
   const state=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,body:!!document.body,theme:document.documentElement.dataset.theme||""}));
   assert.ok(state.body,route);
   assert.ok(state.scrollWidth<=state.width+2,route+" horizontal overflow: "+JSON.stringify(state));
   assert.deepEqual(errors,[],route+" errors");
   results.push({route,...state});
  }finally{await context.close()}
 }
}finally{await browser.close()}
console.log("WebKit iPhone emulation PASS: "+results.length+" routes");
