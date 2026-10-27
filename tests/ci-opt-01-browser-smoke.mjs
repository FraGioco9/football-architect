import {chromium,devices} from "playwright";
import assert from "node:assert/strict";
const routes={calendar:"/calendar",clubs:"/clubs",competitions:"/competitions/it-1/standings",guide:"/guide"};
const area=process.env.FA_TARGET_AREA;
assert.ok(Object.hasOwn(routes,area),"Unknown area");
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({...devices["Desktop Chrome"],viewport:{width,height:844},reducedMotion:"reduce"});
  try{
   const page=await context.newPage();const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   const response=await page.goto("http://app.localhost:2000"+routes[area],{waitUntil:"networkidle",timeout:30000});
   assert.equal(response?.status(),200,area);
   const x=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
   assert.ok(x.scroll<=x.width+2,JSON.stringify({area,width,x}));
   assert.deepEqual(errors,[],area+" JS errors");
   const links=await page.locator("a[href]").count();
   assert.ok(links>0,area+" navigation links absent");
  }finally{await context.close()}
 }
}finally{await browser.close()}
console.log("TARGETED browser smoke PASS: "+area+" at 320/390/768/1440");
