import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import routes from '../assets/routes-registry.js';

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
  assert.equal(link.href,'/calendar?calendarView='+view);
  storage.getItem=()=> '4';
  listeners.click();
  assert.equal(link.href,'/calendar?calendarView='+view);
  assert.ok(listeners.focus);
 });
 test('CAL-SEASON-LINK-01 DEV snapshot fallback '+view,()=>{
  assert.equal(scenario({snapshot:true,season:'2',mobile}).link.href,'/calendar?calendarView='+view);
 });
 test('CAL-SEASON-LINK-01 public cannot inherit DEV storage '+view,()=>{
  assert.equal(scenario({season:'4',mobile}).link.href,'/calendar?calendarView='+view);
 });
 test('CAL-SEASON-LINK-01 invalid DEV season fallback '+view,()=>{
  assert.equal(scenario({dev:true,season:'99',mobile}).link.href,'/calendar?calendarView='+view);
 });
}
test('CAL-SEASON-LINK-01 historical season URLs remain supported',()=>{
 const calendar=readFileSync(new URL('../assets/calendar-simplified.js',import.meta.url),'utf8');
 assert.match(calendar,/faRoutesRegistry\.resolveSeasonQuery\(params,current\?\?limit\)/);
 assert.match(calendar,/calendarQuery\(selectedSeason,params,\{keepExplicit:choice\.explicit\}\)/);
});

for(const mobile of [false,true])test('CAL-SEASON-LINK-01 localhost DEV without subdomains '+(mobile?'mobile':'desktop'),()=>{
 assert.equal(scenario({preview:true,season:'4',mobile}).link.href,'/calendar?calendarView='+(mobile?'week':'season'));
});
test('CAL-SEASON-LINK-01 preview server sets DEV marker before page scripts',()=>{
 const server=readFileSync(new URL('../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
 assert.ok(server.includes('DEBUG_MODE_BOOTSTRAP'));
 const artifact=readFileSync(new URL('../tools/dev-preview-artifact.mjs',import.meta.url),'utf8');assert.ok(artifact.includes('window.faDevPreviewMode=true'));
});


test('Calendar season 0 keeps season 1 selectable without an inactive-season message',()=>{
 const calendar=readFileSync(new URL('../assets/calendar-simplified.js',import.meta.url),'utf8');
 const snippet=calendar.slice(calendar.indexOf(' const readDebugSeason='),calendar.indexOf(" window.addEventListener('fa:dev-progress-change',updateSeason)"));
 for(const requested of ['0','1','3']){
  let href='https://example.test/calendar?season='+requested;
  const menu={dataset:{},children:[],replaceChildren(){this.children=[]},append(option){this.children.push(option)}};
  const value={textContent:'',dataset:{}};
  const trigger={disabled:false};
  const root={dataset:{}};
  const document={documentElement:{dataset:{}},getElementById:()=>null,createElement:()=>({dataset:{},setAttribute(){},addEventListener(){}})};
  const window={dispatchEvent(){},faRoutesRegistry:routes};
  const history={replaceState(state,title,url){href=String(url)}};
  const location={get href(){return href},pathname:'/calendar',get search(){return new URL(href).search}};
  runInNewContext(snippet+';updateSeason();',{document,window,history,location,URL,URLSearchParams,sessionStorage:{getItem:()=> '0'},seasonKey:'season',dev:true,publicDefaultApplied:false,CustomEvent:class{},menu,value,trigger,root,selector:{querySelector:()=>({})},calendarTexts:()=>({season:'Season'}),closeMenu(){},chooseSeason(){}});
  assert.equal(window.faCalendarSelectedSeason(),1);
  assert.equal(value.textContent,'1');
  assert.equal(trigger.disabled,false);
  assert.deepEqual(menu.children.map(option=>option.dataset.menuValue),['1']);
  assert.equal(new URL(href).searchParams.get('season'),requested==='1'?'1':null);
 }
});
test('first verified public season releases the pending picker, then identical updates preserve its open menu',()=>{
 const source=readFileSync(new URL('../assets/competition-tabs.js',import.meta.url),'utf8');
 const snippet=source.slice(source.indexOf('  window.faCompetitionRoute.setPublicSeasonLimit='),source.indexOf('  window.faCompetitionRoute.setSeasonLimit='));
 let updates=0,applies=0;const window={faCompetitionRoute:{}},state={season:'1'};
 runInNewContext('let publicSeasonConfirmed=false;let explicitSeason=false;\n'+snippet,{window,devSeasons:[],availableSeasons:['1','2'],latestSeason:'2',state,seasonPicker:{update(){updates++}},seasonOptions:()=>[],apply(next){applies++;state.season=next.season}});
 assert.equal(window.faCompetitionRoute.setPublicSeasonLimit(2),true);
 assert.equal(updates,1,'The first verified world update releases the pending season value');
 assert.equal(applies,1);
 assert.equal(window.faCompetitionRoute.setPublicSeasonLimit(2),true);
 assert.equal(updates,1,'Identical world updates keep an already-open menu and its options stable');
 assert.equal(applies,1);
});
for(const mobile of [false,true])test('public sidebar uses authoritative current season independently of the viewed season '+mobile,()=>{
 const link={dataset:{},setAttribute(k,v){this[k]=v},addEventListener(){}};
 runInNewContext(snippet+';rewriteAppLinks();',{document:{documentElement:{dataset:{}},querySelectorAll:()=>[]},window:{faWorldState:{get:()=>({current:{season:2,day:4}})},matchMedia:()=>({matches:mobile})},sessionStorage:{getItem:()=>{throw Error('Public source cannot read Debug storage')}},links:{calendar:link},appHref:x=>x,siteHref:x=>x});
 assert.equal(link.href,'/calendar?calendarView='+(mobile?'week':'season'));
});
