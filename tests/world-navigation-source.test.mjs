import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import registry from '../assets/routes-registry.js';
const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const rewrite=source.slice(source.indexOf('  function rewriteAppLinks() {'),source.indexOf('  function language()',source.indexOf('  function rewriteAppLinks() {')));
function links({enabled=false,globalSeason=2}={}){
 const make=href=>({dataset:{},href,getAttribute(key){return key==='href'?this.href:key==='data-dev-latest-season'?'4':null},setAttribute(key,value){if(key==='href')this.href=value},addEventListener(){}});
 const calendar=make('/calendar'),card=make('/competitions/it-1/standings');
 const document={documentElement:{dataset:{}},querySelectorAll:selector=>selector==='a.app-division-card'?[card]:[]};
 const window={location:{href:'http://localhost:2000/dashboard'},faDevPreviewMode:true,faRoutesRegistry:registry,matchMedia:()=>({matches:false})};
 runInNewContext(rewrite+';rewriteAppLinks();',{document,window,URL,globalWorld:globalSeason===null?null:{seasonNumber:globalSeason},links:{calendar},appHref:x=>x,siteHref:x=>x,sessionStorage:{getItem:key=>key==='football-architect:local-debug-visible'?(enabled?'1':null):'3'}});
 return {calendar:calendar.href,card:card.href};
}
test('Debug OFF links ignore saved local season and card metadata',()=>{
 assert.deepEqual(links(),{calendar:'/calendar?season=2&calendarView=season',card:'/competitions/it-1/standings?season=2'});
});
test('Debug ON navigation uses the explicitly enabled local source',()=>{
 assert.deepEqual(links({enabled:true}),{calendar:'/calendar?season=3&calendarView=season',card:'/competitions/it-1/standings?season=4'});
});
test('missing global world and Season 0 links leave season resolution to the destination',()=>{
 for(const globalSeason of [null,0])assert.deepEqual(links({globalSeason}),{calendar:'/calendar?calendarView=season',card:'/competitions/it-1/standings'});
});

test('late navigation world reads cannot overwrite a newer global season',async()=>{
 const {validPublicWorld}=await import('../assets/authoritative-season.mjs');
 const start=source.indexOf('  const refreshWorldLinks=async()=>{');
 const end=source.indexOf("  window.addEventListener('focus',refreshWorldLinks);",start);
 const refresh=source.slice(start,end).replace("await import('/assets/authoritative-season.mjs')",'authoritative');
 const releases=[],rendered=[],world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:3,seasonNumber:1,day:1,phase:'active'};
 const context={authoritative:{validPublicWorld},fetch:()=>new Promise(resolve=>releases.push(resolve)),rendered};
 runInNewContext("let globalWorld=null,worldLinksRevision=0;function rewriteAppLinks(){rendered.push(globalWorld.seasonNumber)}"+refresh+';globalThis.refresh=refreshWorldLinks;',context);
 const old=context.refresh(),latest=context.refresh();
 releases[1]({ok:true,json:async()=>({world:{...world,seasonNumber:2,revision:5}})});await latest;
 releases[0]({ok:true,json:async()=>({world})});await old;
 assert.deepEqual(rendered,[2]);
});
