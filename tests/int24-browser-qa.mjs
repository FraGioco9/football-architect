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
const languages={en:"Overview",de:"Übersicht",es:"Resumen",fr:"Aperçu",it:"Panoramica"};
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
  await page.goto(base+"/competitions/"+cup+"?view=overview",{waitUntil:"networkidle"});
  for(const [lang,label] of Object.entries(languages)){
   await page.evaluate(lang=>{document.documentElement.lang=lang},lang);
   await page.waitForFunction(expected=>document.querySelector("#international-view-heading")?.textContent===expected,label);
   assert.equal(await page.locator('[data-cup-tab="overview"]').innerText(),label);
   checks++;
  }
  for(const theme of ["dark","light"]){
   await page.evaluate(value=>localStorage.setItem("football-architect:theme",value),theme);
   await page.reload({waitUntil:"networkidle"});
   assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
   await page.screenshot({path:out+"/"+cup+"-"+width+"-"+theme+".png",fullPage:true});
   checks++;
  }
  const tabs=page.locator("[data-cup-tab]");
  assert.equal(await tabs.count(),5);
  await tabs.first().focus();
  assert.equal(await tabs.first().evaluate(el=>document.activeElement===el),true);
  await page.keyboard.press("Tab");
  assert.equal(await tabs.nth(1).evaluate(el=>document.activeElement===el),true);
  await page.keyboard.press("Enter");
  await page.waitForURL("**?view=standings");
  assert.equal(await page.locator('[data-cup-tab="standings"]').getAttribute("aria-current"),"page");
  checks++;

  assert.deepEqual(errors,[],"JS errors "+cup+" "+width);
  await page.close();
 }
 console.log("INT24 Chromium QA PASS: "+checks+" checks; 12 screenshots");
}finally{await browser.close()}
