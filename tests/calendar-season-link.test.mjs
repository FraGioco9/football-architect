import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const start=source.indexOf('  function rewriteAppLinks() {');
const end=source.indexOf('  function language() {',start);
assert.ok(start>=0&&end>start);
const snippet=source.slice(start,end);

function scenario({dev=false,preview=false,snapshot=false,season='3',mobile=false}={}){
 const listeners={};
 const link={dataset:{},setAttribute(name,value){this[name]=value},addEventListener(name,callback){listeners[name]=callback}};
 const links={calendar:link};
 const root={dataset:{...(dev?{faDevAppOrigin:'http://localhost:2000'}:{}),}};
 const document={documentElement:root,querySelectorAll:()=>[]};
 const window={faDevPreviewMode:preview,matchMedia:()=>({matches:mobile}),faDevCalendarClockSnapshot:snapshot?{source:{kind:'dev'}}:undefined};
 const sessionStorage={getItem:key=>key==='football-architect:standings-dev-season'?season:null};
 runInNewContext(snippet+';rewriteAppLinks();',{document,window,sessionStorage,links,appHref:x=>x,siteHref:x=>x});
 return {link,listeners,storage:sessionStorage};
}
for(const mobile of [false,true]){
 const view=mobile?'week':'season';
 test('CAL-SEASON-LINK-01 current DEV season from sidebar '+view,()=>{
  const {link,listeners,storage}=scenario({dev:true,season:'3',mobile});
  assert.equal(link.href,'/calendar?season=3&calendarView='+view);
  storage.getItem=()=> '4';
  listeners.click();
  assert.equal(link.href,'/calendar?season=4&calendarView='+view);
  assert.ok(listeners.focus);
 });
 test('CAL-SEASON-LINK-01 DEV snapshot fallback '+view,()=>{
  assert.equal(scenario({snapshot:true,season:'2',mobile}).link.href,'/calendar?season=2&calendarView='+view);
 });
 test('CAL-SEASON-LINK-01 public cannot inherit DEV storage '+view,()=>{
  assert.equal(scenario({season:'4',mobile}).link.href,'/calendar?season=1&calendarView='+view);
 });
 test('CAL-SEASON-LINK-01 invalid DEV season fallback '+view,()=>{
  assert.equal(scenario({dev:true,season:'99',mobile}).link.href,'/calendar?season=1&calendarView='+view);
 });
}
test('CAL-SEASON-LINK-01 historical season URLs remain supported',()=>{
 const calendar=readFileSync(new URL('../assets/calendar-simplified.js',import.meta.url),'utf8');
 assert.match(calendar,/params\.has\('season'\)&&validSeason\(requested\)/);
 assert.match(calendar,/selectedSeason=requested/);
});

for(const mobile of [false,true])test('CAL-SEASON-LINK-01 localhost DEV without subdomains '+(mobile?'mobile':'desktop'),()=>{
 assert.equal(scenario({preview:true,season:'4',mobile}).link.href,'/calendar?season=4&calendarView='+(mobile?'week':'season'));
});
test('CAL-SEASON-LINK-01 preview server sets DEV marker before page scripts',()=>{
 const server=readFileSync(new URL('../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
 assert.ok(server.includes('window.faDevPreviewMode=true'));
});
