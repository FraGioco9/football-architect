// REPO-493 step 05: focused real-browser evidence, not the entire audit matrix.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';

const engine=process.env.FA_REPO_493_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
const playwright=await import('playwright');
const server=createPreviewServer({devPreview:true});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const evidence=[];
let browser;
const views=['standings','postseason','fixtures','stats','history','rules','awards'];
const competitions=[['it-1',390],['eng-2',1440],['int-1',390],['int-2',1440]];
const clubs=[['it',1,'overview',390],['eng',40,'fixtures',1440],['br',1,'stats',390],['nl',40,'history',1440]];
function record(route,width,stage,status,details){
 evidence.push({route,width,stage,status,details});
}
try{
 browser=await playwright[engine].launch({headless:true});
 for(const [id,width] of competitions)for(const view of views){
  const route='/competitions/'+id+'/'+view+'?season=1';
  const page=await browser.newPage({viewport:{width,height:900}});
  try{
   const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(response?.status(),200,route);
   const state=await page.evaluate(()=>{
    const tabs=[...document.querySelectorAll('#app-divisions .app-competition-tab')];
    const panels=[...document.querySelectorAll('#app-divisions > .app-competition-panel')];
    return {
     selectedView:document.documentElement.dataset.competitionView,
     tabCount:tabs.length,
     selected:tabs.filter(e=>e.getAttribute('aria-selected')==='true').map(e=>e.id),
     panelCount:panels.length,
     visible:panels.filter(e=>!e.hidden).map(e=>e.id),
     seasonReserved:!!document.querySelector('#app-competition-season-control'),
     fixturesReserved:!!document.querySelector('#app-fixtures-round'),
     tabsHeight:document.querySelector('#app-divisions > .app-competition-tabs')?.getBoundingClientRect().height??0
    };
   });
   assert.equal(state.selectedView,view,route+' parsed view');
   assert.equal(state.tabCount,7,route+' tabs');
   assert.deepEqual(state.selected,['competition-tab-'+view],route+' active tab');
   assert.equal(state.panelCount,7,route+' panels');
   assert.deepEqual(state.visible,['competition-panel-'+view],route+' active panel');
   assert.equal(state.seasonReserved,true,route+' season slot');
   assert.equal(state.fixturesReserved,true,route+' fixture selector slot');
   assert.ok(state.tabsHeight>0,route+' tab geometry');
   record(route,width,'DOMContentLoaded','PASS',state);
  }catch(error){record(route,width,'DOMContentLoaded','FAIL',String(error));throw error;}
  finally{await page.close();}
 }
 for(const [country,id,view,width] of clubs){
  const route='/clubs/'+country+'/'+id+'/'+view;
  const page=await browser.newPage({viewport:{width,height:900}});
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  await page.route('**/clubs/_shared/manifest.json',async request=>{
   await pending;
   if(page.isClosed())return;
   try{await request.continue();}
   catch(error){if(!page.isClosed()&&!/Route is already handled|Target closed/i.test(String(error)))throw error;}
  });
  try{
   const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(response?.status(),200,route);
   await page.waitForFunction(()=>document.documentElement.dataset.clubShellReady==='true',null,{timeout:15000});
   const first=await page.evaluate(()=>{
    const tabs=[...document.querySelectorAll('#club-page > .club-tabs [data-club-first-paint-tab]')];
    return {title:document.querySelector('#club-title')?.textContent,
      selected:tabs.filter(e=>e.getAttribute('aria-current')==='page').map(e=>e.dataset.clubFirstPaintTab),
      tabCount:tabs.length,
      ready:document.documentElement.dataset.clubReady==='true'};
   });
   assert.equal(first.title,'',route+' anonymous first paint');
   assert.equal(first.tabCount,5,route+' static tabs');
   assert.deepEqual(first.selected,[view],route+' initial selection');
   assert.equal(first.ready,false,route+' manifest held');
   record(route,width,'held-manifest','PASS',first);
   release();
   await page.waitForFunction(()=>document.documentElement.dataset.clubReady==='true',null,{timeout:25000});
   const title=await page.locator('#club-title').textContent();
   assert.ok(title?.trim(),route+' hydrated name');
   assert.equal(await page.locator('#club-page > .club-tabs [aria-current="page"]').count(),1);
   record(route,width,'hydrated','PASS',{title});
  }catch(error){record(route,width,'club-first-paint','FAIL',String(error));throw error;}
  finally{release();await page.close();}
 }
 console.log('REPO-493 browser '+engine+': '+evidence.filter(e=>e.status==='PASS').length+
  ' PASS assertions; remaining matrix states UNKNOWN.');
}finally{
 mkdirSync('int24-browser-artifacts',{recursive:true});
 writeFileSync('int24-browser-artifacts/repo-493-first-paint-'+engine+'.json',
  JSON.stringify({issue:493,engine,sha:process.env.GITHUB_SHA||'local',scope:'risk-based sample only',evidence},null,2)+'\n');
 if(browser)await browser.close();
 server.closeAllConnections?.();
 await new Promise(resolve=>server.close(resolve));
}
