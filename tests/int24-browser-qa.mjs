import {chromium} from "playwright";
import {mkdirSync} from "node:fs";
import assert from "node:assert/strict";

const base="http://127.0.0.1:2000";
const out="int24-browser-artifacts";
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const widths=[1440,390,320];
const cups=["sovereign-cup","federation-cup"];
const views=["overview","standings","fixtures","stats","history"];
const languages=["en","de","es","fr","it"];
let checks=0;
try {
 for(const cup of cups)for(const width of widths){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  for(const view of views){
   const url=base+"/competitions/"+cup+"?view="+view;
   const response=await page.goto(url,{waitUntil:"networkidle"});
   assert.equal(response?.status(),200,url);
   await page.waitForSelector('[data-cup-tab="'+view+'"][aria-current="page"]');
   assert.equal(await page.locator("#international-view-heading").count(),1);
   const heading=await page.locator("#international-view-heading").innerText();
   assert.ok(heading.length>0);
   const body=await page.locator("#international-view-body").innerText();
   assert.ok(body.length>10);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
   assert.equal(overflow,false,"horizontal overflow "+cup+" "+width+" "+view);
   checks++;
  }
  for(const lang of languages){
   await page.evaluate(lang=>{document.documentElement.lang=lang},lang);
   await page.waitForFunction(lang=>document.documentElement.lang===lang&&document.querySelector("#international-view-heading")?.textContent?.length>0,lang);
   checks++;
  }
  await page.goto(base+"/competitions/"+cup+"?view=overview",{waitUntil:"networkidle"});
  await page.screenshot({path:out+"/"+cup+"-"+width+"-overview.png",fullPage:true});
  assert.deepEqual(errors,[],"JS errors "+cup+" "+width);
  await page.close();
 }
 console.log("INT24 Chromium QA PASS: "+checks+" checks; 6 screenshots");
}finally{await browser.close()}
