// Read-only browser resource timing inventory. Does not change delivery or script order.
import {chromium} from "playwright";
import {mkdirSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
const origin="http://app.localhost:2000";
const routes=["/dashboard","/calendar","/settings","/competitions","/clubs","/competitions/it-1/standings","/guide"];
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const route of routes){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
  try{
   const page=await context.newPage();
   const responses=[];
   page.on("response",r=>{if(new URL(r.url()).origin===origin)responses.push({url:r.url(),status:r.status(),type:r.request().resourceType()})});
   const response=await page.goto(origin+route,{waitUntil:"networkidle",timeout:30000});
   assert.equal(response?.status(),200,route);
   const timings=await page.evaluate(()=>performance.getEntriesByType("resource").map(e=>({name:e.name,initiatorType:e.initiatorType,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,duration:e.duration})));
   const resources=timings.filter(x=>x.name.startsWith(origin+"/"));
   const unknownTransfer=resources.filter(x=>x.transferSize===0&&x.decodedBodySize>0).length;
   results.push({route,requests:responses.length,failed:responses.filter(x=>x.status>=400),timedResources:resources.length,transferBytes:resources.reduce((n,x)=>n+x.transferSize,0),decodedBytes:resources.reduce((n,x)=>n+x.decodedBodySize,0),unknownTransfer,resources});
  }finally{await context.close()}
 }
}finally{await browser.close()}
mkdirSync("int24-browser-artifacts",{recursive:true});
writeFileSync("int24-browser-artifacts/clean-ui-03-network-baseline.json",JSON.stringify({measurement:"Chromium loopback DEV, cold context per route; transferSize may be 0 due to browser timing restrictions/cache",results},null,2));
for(const x of results){assert.deepEqual(x.failed,[],x.route);assert.ok(x.requests>=1,x.route);console.log(`${x.route}: ${x.requests} responses, ${x.transferBytes} transfer bytes, ${x.decodedBytes} decoded bytes, unknown transfer: ${x.unknownTransfer}`)}
