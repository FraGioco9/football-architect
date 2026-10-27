import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {browserCases,areaRoutes,verifyArea} from './ci-opt-01-browser-cases.mjs';

export async function runArea(browser,area,engine='chromium'){
 assert.ok(Object.hasOwn(areaRoutes,area),'Unknown area');
 let checks=0;
 for(const config of browserCases()){
  const {width,theme,language,touch}=config;
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:touch,locale:language,reducedMotion:'reduce'});
  const page=await context.newPage();
  try{
   await context.addInitScript(({language,theme})=>{
    localStorage.setItem('football-architect:language',language);
    localStorage.setItem('football-architect:theme',theme);
   },config);
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto('http://app.localhost:2000'+areaRoutes[area],{waitUntil:'networkidle',timeout:30000});
   assert.equal(response?.status(),200,area);
   const state=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,language:document.documentElement.lang,theme:document.documentElement.dataset.theme}));
   assert.ok(state.scroll<=state.width+2,JSON.stringify({area,config,state}));
   assert.equal(state.language,language,area+' language');
   assert.equal(state.theme,theme,area+' theme');
   await verifyArea(page,area,config);
   assert.deepEqual(errors,[],area+' JS errors');
   checks++;
  }catch(error){
   const out='int24-browser-artifacts';mkdirSync(out,{recursive:true});
   const name=out+'/targeted-'+engine+'-'+area+'-'+width+'-'+language+'-'+theme;
   await page.screenshot({path:name+'.png',fullPage:true}).catch(()=>{});
   writeFileSync(name+'.json',JSON.stringify({area,engine,config,url:page.url(),error:String(error)},null,2));
   throw error;
  }finally{await context.close()}
 }
 console.log('TARGETED '+engine+' PASS: '+area+' '+checks+' cases (pairwise widths/locales/themes; touch + keyboard)');
 return checks;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const engine=process.env.FA_BROWSER_ENGINE||'chromium';
 assert.ok(['chromium','webkit'].includes(engine),'Unknown engine');
 const playwright=await import('playwright');
 const browser=await playwright[engine].launch({headless:true});
 try{await runArea(browser,process.env.FA_TARGET_AREA,engine)}finally{await browser.close()}
}
