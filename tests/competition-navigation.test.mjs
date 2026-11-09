import routeRegistry from '../assets/routes-registry.js';
import competitionModel from "../assets/competition-model.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import rules from '../assets/competition-rules.js';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const definitions=loadCompetitionCatalogue();
const source=readFileSync(new URL('../assets/competition-tabs.js',import.meta.url),'utf8');
const views=['standings','postseason','fixtures','stats','history','rules','awards'];
function setup(path='/competitions/it-1/',devSeason=null,registry=routeRegistry,restoredScroll=null,initialPublicSeason=null){
 const contextSeasons=[],scrollKeys=[];const fields=new Map(),events={},stack=[new URL(path,'https://example.test')];let cursor=0;
 const item=()=>({hidden:false,value:'',dataset:{},events:{},attrs:{},classList:{toggle(){}},
  removeAttribute(k){delete this.attrs[k]},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this.events[k]=fn},focus(){this.focused=true},scrollIntoView(){}});
 // Empty navigation panels still expose DOM queries used by History initialization.
 const tabs=views.map(view=>{const tab=item();tab.id='competition-tab-'+view;tab.getAttribute=()=> 'competition-panel-'+view;const panel=item();panel.querySelectorAll=()=>[];fields.set('competition-panel-'+view,panel);return tab});
 fields.set('app-competition-season',item());fields.set('app-competition-season-unavailable',item());
 const option=item();option.id='app-competition-season-option-1';option.dataset.menuValue='1';
 const menu=item();menu.options=[option];
 menu.querySelector=selector=>menu.options.find(node=>node.dataset.menuValue===selector.match(/="([^"]+)"/)?.[1]);
 menu.append=node=>{menu.options=menu.options.filter(item=>item!==node);menu.options.push(node)};
 menu.querySelectorAll=()=>menu.options;
 option.remove=()=>{menu.options=menu.options.filter(node=>node!==option)};
 fields.set('app-competition-season-menu',menu);
 fields.set('app-competition-season-value',item());fields.set('app-competition-season-control',{contains:()=>false});
 fields.set('app-competition-season-option-1',option);
 const tablist=item();tablist.clientWidth=240;tablist.scrollWidth=620;let scroll=0;
 Object.defineProperty(tablist,'scrollLeft',{get:()=>scroll,set:value=>scroll=Math.max(0,Math.min(380,value))});
 tablist.querySelectorAll=()=>tabs;tablist.getBoundingClientRect=()=>({left:0,right:240});
 tabs.forEach((tab,i)=>tab.getBoundingClientRect=()=>({left:i*104-scroll,right:i*104+100-scroll}));
 const document={addEventListener(){},documentElement:{dataset:devSeason!==null?{faDevSeasons:'1,2,3,4',faDevCurrentSeason:String(devSeason)}:{}},getElementById:id=>fields.get(id),querySelector:()=>tablist,
 createElement(){const node=item();node.remove=()=>{menu.options=menu.options.filter(item=>item!==node)};return node}};
 const definition=definitions.find(d=>path.includes('/'+d.slug+'/')||path.includes('/'+d.slug+'?'));
 const window={faCompetitionInitialSeason:initialPublicSeason,faRoutesRegistry:registry,faCompetitionRules:rules,faCompetitionContext:definition?{definition}:null,faCompetitionContextApi:{selectSeason:season=>contextSeasons.push(Number(season))},faCompetitionModel:competitionModel,get location(){return stack[cursor]},history:{
  replaceState(a,b,url){stack[cursor]=new URL(url,stack[cursor])},
  pushState(a,b,url){stack.splice(cursor+1);stack.push(new URL(url,stack[cursor]));cursor++}},
  dispatchEvent(){},addEventListener(k,fn){events[k]=fn}};
 runInNewContext(source,{document,window,URL,sessionStorage:{getItem(key){scrollKeys.push(key);return key.startsWith('football-architect:competition-tabs-scroll:')&&restoredScroll!==null?String(restoredScroll):null},setItem(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}});
 return {window,tabs,fields,tablist,events,contextSeasons,scrollKeys,back(){cursor--;events.popstate()},forward(){cursor++;events.popstate()},count:()=>stack.length};
}
test('CONFIG-URL: cup routes use phase-only links with Back/Forward',()=>{
 const s=setup('/competitions/int-1/fixtures?season=1&matchday=30');
 assert.equal(s.window.faCompetitionRoute.get().matchday,1);
 s.window.faCompetitionRoute.set({matchday:'quarterfinals:2'});
 assert.equal(s.window.faCompetitionRoute.get().matchday,'quarterfinals:1');
 assert.equal(s.window.location.search,'?season=1&matchday=quarterfinals');
 s.window.faCompetitionRoute.set({matchday:'final:1'});
 assert.equal(s.window.location.search,'?season=1&matchday=final');
 s.back();
 assert.equal(s.window.faCompetitionRoute.get().matchday,'quarterfinals:1');
 s.window.faCompetitionRoute.set({matchday:'playout'});
 assert.equal(s.window.faCompetitionRoute.get().matchday,'quarterfinals:1');
});
test('DEV season menu ends at current progress and redirects an invalid future season to the current season',()=>{
 const s=setup('/competitions/it-1?season=3&view=fixtures&matchday=13',3);
 const menu=s.fields.get('app-competition-season-menu');
 assert.deepEqual(menu.options.map(node=>node.dataset.menuValue),['3','2','1']);
 s.window.faCompetitionRoute.setSeasonLimit(2);
 assert.deepEqual(menu.options.map(node=>node.dataset.menuValue),['2','1']);
 assert.deepEqual(JSON.parse(JSON.stringify(s.window.faCompetitionRoute.get())),{season:'2',view:'fixtures',matchday:13});
 s.window.faCompetitionRoute.set({season:'1'});
 s.window.faCompetitionRoute.setSeasonLimit(3);
 assert.equal(s.window.faCompetitionRoute.get().season,'1','Raising Debug keeps a valid viewed season');
 assert.deepEqual(menu.options.map(node=>node.dataset.menuValue),['3','2','1']);
 menu.querySelector('[data-menu-value="3"]').events.click();
 assert.equal(s.window.faCompetitionRoute.get().season,'3','Newly added options remain interactive');
 s.window.faCompetitionRoute.setSeasonLimit(1);
 assert.equal(s.window.faCompetitionRoute.get().season,'1');
 s.back();assert.equal(s.window.faCompetitionRoute.get().season,'1','Back navigation cannot reveal a future season');
});
test('DEV future deep links normalize to the current season',()=>{
 const s=setup('/competitions/it-1?season=4&view=stats',2);
 assert.equal(s.window.faCompetitionRoute.get().season,'2');
 assert.equal(s.fields.get('competition-panel-stats').hidden,false);
});
test('COMPETITION-URL: canonical deep links restore every view, round and browser history',()=>{
 const s=setup('/competitions/it-1/fixtures?season=1&matchday=12');
 assert.equal(s.window.location.pathname,'/competitions/it-1/fixtures');
 assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
 assert.equal(s.window.faCompetitionRoute.get().matchday,12);
 s.window.faCompetitionRoute.set({matchday:13});
 assert.equal(s.window.location.search,'?season=1&matchday=13');
 s.tabs[3].events.click();assert.equal(s.window.location.search,'?season=1');
 s.back();assert.equal(s.window.faCompetitionRoute.get().matchday,13);assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
 s.back();assert.equal(s.window.faCompetitionRoute.get().matchday,12);
 s.forward();assert.equal(s.window.faCompetitionRoute.get().matchday,13);
 for(let i=0;i<views.length;i++){s.tabs[i].events.click();assert.equal(s.window.faCompetitionRoute.get().view,views[i]);assert.equal([...s.fields].filter(([id,p])=>id.startsWith('competition-panel-')&&!p.hidden).length,1);}
});
test('INT-24 legacy leg links normalize on both cups',()=>{
 for(const cup of ['int-1','int-2'])for(const phase of ['playoffs','quarterfinals','semifinals','final']){
  for(const suffix of ['', '%3A1', '%3A2']){
   const link=setup('/competitions/'+cup+'/fixtures?season=1&matchday='+phase+suffix);
   assert.equal(link.window.faCompetitionRoute.get().matchday,phase+':1');
   assert.equal(link.window.location.search,'?season=1&matchday='+phase);
  }
 }
});
test('COMPETITION-URL: invalid parameters normalize while explicit public seasons remain selected',()=>{
 const s=setup('/competitions/it-1/index.html?season=bad&view=unknown&matchday=999');
 assert.equal(s.window.location.pathname,'/competitions/it-1/standings');
 assert.equal(s.window.location.search,'?season=1');assert.equal(s.count(),1);
 const missing=setup('/competitions/it-1?season=2&view=fixtures&matchday=4');
 assert.equal(missing.window.faCompetitionRoute.get().season,'2','Do not invent a public world before its response');
 assert.equal(missing.fields.get('app-competition-season-unavailable').hidden,true,'Never show the retired notice');
 assert.equal(missing.fields.get('competition-panel-fixtures').hidden,false,'Static view never disappears');
 missing.window.faCompetitionRoute.setPublicSeasonLimit(1);
 assert.equal(missing.window.faCompetitionRoute.get().season,'1');
 assert.equal(missing.window.location.search,'?season=1&matchday=4');
 assert.equal(missing.count(),1,'Redirect replaces the history entry');
 const future=setup('/competitions/int-1/fixtures?season=9&matchday=playoffs:1');
 future.window.faCompetitionRoute.setPublicSeasonLimit(2);
 assert.equal(future.window.faCompetitionRoute.get().season,'2');
 assert.equal(future.window.location.search,'?season=2&matchday=playoffs');
 const historical=setup('/competitions/int-1/history?season=1');
 historical.window.faCompetitionRoute.setPublicSeasonLimit(2);
 assert.equal(historical.window.faCompetitionRoute.get().season,'1');
 const unstarted=setup('/competitions/it-1/rules?season=9');
 unstarted.window.faCompetitionRoute.setPublicSeasonLimit(0);
 assert.equal(unstarted.window.faCompetitionRoute.get().season,'1');
 assert.equal(unstarted.fields.get('app-competition-season-value').textContent,'1');
});
test('PUBLIC first paint uses verified latest Season 2 without showing 1 or skeleton',()=>{
 const latest=setup('/competitions/it-1/standings',null,routeRegistry,null,2);
 assert.equal(latest.window.faCompetitionRoute.get().season,'2');
 assert.equal(latest.fields.get('app-competition-season-value').textContent,'2');
 assert.equal(latest.fields.get('app-competition-season').disabled,false);
 assert.equal(latest.window.location.search,'?season=2');
 const historical=setup('/competitions/it-1/standings?season=1',null,routeRegistry,null,2);
 assert.equal(historical.fields.get('app-competition-season-value').textContent,'1');
 const future=setup('/competitions/it-1/standings?season=9',null,routeRegistry,null,2);
 assert.equal(future.fields.get('app-competition-season-value').textContent,'2');
 assert.equal(future.window.location.search,'?season=2');
});
test('PUBLIC season picker reserves its label until world confirms the redirect; no future numeral flashes',()=>{
 const future=setup('/competitions/it-1/fixtures?season=99&matchday=4');
 const value=future.fields.get('app-competition-season-value'),trigger=future.fields.get('app-competition-season');
 assert.equal(future.window.faCompetitionRoute.get().season,'99','Unverified route identity is retained without inventing a clock');
 assert.equal(value.textContent,'','Unverified future value is not rendered');
 assert.equal(value.dataset.seasonPending,'true');
 assert.equal(trigger.disabled,true,'Unverified picker must not offer provisional options');
 future.window.faCompetitionRoute.setPublicSeasonLimit(2);
 assert.equal(future.window.faCompetitionRoute.get().season,'2');
 assert.equal(value.textContent,'2','Only the verified world season is displayed');
 assert.equal(value.dataset.seasonPending,'false');
 assert.equal(trigger.disabled,false);
 const unstarted=setup('/competitions/it-1/standings?season=1');
 const unstartedValue=unstarted.fields.get('app-competition-season-value');
 assert.equal(unstartedValue.textContent,'1','An explicit Season 1 is safe to show without a source read');
 unstarted.window.faCompetitionRoute.setPublicSeasonLimit(0);
 assert.equal(unstartedValue.textContent,'1','Season 0 confirms Season 1 even when the option list is unchanged');
 assert.equal(unstarted.fields.get('app-competition-season').disabled,false);
});

test('COMPETITION-URL: keyboard navigation retains one active tab and does not duplicate history entries',()=>{
 const s=setup();let prevented=false;
 s.tabs[0].events.keydown({key:'ArrowLeft',preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(s.tabs[6].focused,true);assert.equal(s.window.faCompetitionRoute.get().view,'awards');
 const count=s.count();s.tabs[6].events.click();assert.equal(s.count(),count);
 s.tabs[6].events.keydown({key:'Home',preventDefault(){}});assert.equal(s.fields.get('competition-panel-standings').hidden,false);
});

test('COMPETITION-URL: first paint keeps season 1 fallback available',()=>{
 const html=readFileSync(new URL('../competitions/it-1/index.html',import.meta.url),'utf8');
 const bootstrap=html.match(/<script>(\(\(\)=>[\s\S]*?)<\/script>/)[1]
 for(const season of ['1','2','12','999999999']){
  const document={addEventListener(){},documentElement:{dataset:{}}};
  runInNewContext(bootstrap,{document,URLSearchParams,location:{pathname:'/competitions/it-1/fixtures',search:'?season='+season+'&matchday=12'}});
  assert.equal(document.documentElement.dataset.competitionView,'fixtures');
  assert.equal(document.documentElement.dataset.competitionSeasonUnavailable,'false');
 }
});

test('COMPETITION-URL: matchday is scoped to Fixtures URLs while tab changes retain the in-page selection',()=>{
 const s=setup('/competitions/it-1/fixtures?season=1&matchday=12');
 s.tabs[0].events.click();
 assert.equal(s.window.location.search,'?season=1');
 const refreshed=setup(s.window.location.href);
 refreshed.tabs[2].events.click();
 assert.equal(refreshed.window.faCompetitionRoute.get().matchday,1);
 assert.equal(refreshed.window.location.search,'?season=1&matchday=1');
 s.tabs[2].events.click();
 assert.equal(s.window.faCompetitionRoute.get().matchday,12);
 s.back();s.back();assert.equal(s.window.faCompetitionRoute.get().matchday,12);
});


test('COMPETITION-TABS-SCROLL: edge hints follow scrolling and selection stays visible on direct load, navigation and resize',()=>{
 const s=setup('/competitions/it-1?season=1&view=awards');
 assert.equal(s.tablist.dataset.canScrollLeft,'true');
 assert.equal(s.tablist.dataset.canScrollRight,'false');
 assert.equal(s.tablist.scrollLeft,380,'direct link reveals the last tab');
 s.tabs[0].events.click();assert.equal(s.tablist.scrollLeft,0);
 assert.equal(s.tablist.dataset.canScrollLeft,'false');assert.equal(s.tablist.dataset.canScrollRight,'true');
 s.tablist.scrollLeft=150;s.tablist.events.scroll();
 assert.equal(s.tablist.dataset.canScrollLeft,'true');assert.equal(s.tablist.dataset.canScrollRight,'true');
 s.tabs[3].events.click();const rect=s.tabs[3].getBoundingClientRect();
 assert.ok(rect.left>=16&&rect.right<=224,'selected middle tab clears both fades');
 s.tablist.scrollLeft=0;s.events.resize();assert.equal(s.tablist.scrollLeft,0,'same-width observer does not move the strip');
 s.tablist.clientWidth=200;s.events.resize();assert.ok(s.tablist.scrollLeft>0,'genuine viewport-width change reveals selected tab');
 s.tablist.clientWidth=700;s.tablist.scrollWidth=620;s.tablist.scrollLeft=0;s.tablist.events.scroll();
 assert.equal(s.tablist.dataset.canScrollLeft,'false');assert.equal(s.tablist.dataset.canScrollRight,'false');
});

test('COMPETITION-TABS-SCROLL: exact saved offset survives reload and same-width resize',()=>{
 const s=setup('/competitions/it-1?season=1&view=awards',null,routeRegistry,150);
 assert.equal(s.tablist.scrollLeft,150,'the restored offset must not be overridden by active-tab reveal');
 assert.equal(s.tablist.dataset.canScrollLeft,'true');
 assert.equal(s.tablist.dataset.canScrollRight,'true');
 s.events.resize();assert.equal(s.tablist.scrollLeft,150,'same-width observer preserves restored offset');
 s.tabs[0].events.click();assert.equal(s.tablist.scrollLeft,0,'explicit user view selection reveals its tab');
});

test('HISTORY-URL: season links use Standings and preserve browser navigation',()=>{
 const s=setup('/competitions/it-1/history');
 s.window.faCompetitionRoute.set({season:'1',view:'standings'},{focus:true});
 assert.equal(s.window.location.search,'?season=1');
 assert.equal(s.tabs[0].focused,true);
 const refreshed=setup(s.window.location.href);
 assert.equal(refreshed.window.faCompetitionRoute.get().view,'standings');
 s.back();assert.equal(s.window.faCompetitionRoute.get().view,'history');
 s.forward();assert.equal(s.window.faCompetitionRoute.get().view,'standings');
});


test('POSTSEASON-URL: direct load, keyboard selection and browser history restore the new tab',()=>{
 const s=setup('/competitions/it-2?season=1&view=postseason');
 assert.equal(s.fields.get('competition-panel-postseason').hidden,false);
 s.tabs[0].events.click();s.tabs[0].events.keydown({key:'ArrowRight',preventDefault(){}});
 assert.equal(s.window.faCompetitionRoute.get().view,'postseason');
 s.back();assert.equal(s.window.faCompetitionRoute.get().view,'standings');
 s.forward();assert.equal(s.window.faCompetitionRoute.get().view,'postseason');
});

test('FIXTURES-POSTSEASON-URL: named rounds preserve deep links, tabs and browser history without extending league rounds',()=>{
 for(const stage of ['playoffs','playout']){
  const s=setup('/competitions/'+(stage==='playout'?'it-1':'it-2')+'?season=1&matchday='+stage);
  assert.equal(s.window.faCompetitionRoute.get().matchday,stage);
  s.tabs[0].events.click();assert.equal(s.window.location.search,'?season=1');
  s.tabs[2].events.click();assert.equal(s.window.faCompetitionRoute.get().matchday,stage);
  s.window.faCompetitionRoute.set({matchday:30});s.back();assert.equal(s.window.faCompetitionRoute.get().matchday,stage);
  assert.equal(competitionModel.validRound(31),false);
 }
});

test('History and Rules retain the viewed season through navigation and direct reload',()=>{
 const s=setup('/competitions/it-1/standings?season=1');
 s.window.faCompetitionRoute.set({view:'history'});
 assert.equal(s.window.location.pathname,'/competitions/it-1/history');
 assert.equal(s.window.location.search,'?season=1');
 s.window.faCompetitionRoute.set({view:'rules'});
 assert.equal(s.window.location.pathname,'/competitions/it-1/rules');
 assert.equal(s.window.location.search,'?season=1');
 s.window.faCompetitionRoute.set({view:'fixtures',matchday:9});
 assert.equal(s.window.location.pathname,'/competitions/it-1/fixtures');
 assert.equal(s.window.location.search,'?season=1&matchday=9');
 const direct=setup('/competitions/it-1/history?season=4');
 assert.equal(direct.window.location.pathname,'/competitions/it-1/history');
 assert.equal(direct.window.location.search,'?season=4');
});

test('DEV future seasons clamp to progress while unresolved public URLs keep their static view',()=>{
 for(const slug of ['int-1','int-2',...competitionModel.countries.flatMap(c=>[c.toLowerCase()+'-1',c.toLowerCase()+'-2'])]){
  for(const dev of [null,3]){
   const s=setup('/competitions/'+slug+'/fixtures?season=99&matchday=4',dev);
   assert.equal(s.window.faCompetitionRoute.get().season,dev===null?'99':'3');
   assert.equal(s.window.faCompetitionRoute.get().view,'fixtures');
   assert.equal(s.window.faCompetitionRoute.get().matchday,4);
   assert.equal(s.window.location.search,'?season='+(dev===null?'99':'3')+'&matchday=4');
   assert.equal(s.fields.get('app-competition-season-unavailable').hidden,true);
   assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
   s.window.faCompetitionRoute.set({season:'99'});
   assert.equal(s.window.faCompetitionRoute.get().season,dev===null?'99':'3');
  }
  const preview=setup('/competitions/'+slug+'/standings?season=3',3);
  assert.equal(preview.window.faCompetitionRoute.get().season,'3');
  preview.window.faCompetitionRoute.setSeasonLimit(2);
  assert.equal(preview.window.faCompetitionRoute.get().season,'2');
 }
});

test('Debug OFF defers clamping until public world is actually verified',()=>{
 const s=setup('/competitions/it-1/fixtures?season=2&matchday=9');
 s.window.faDebugEnabled=false;
 s.window.faWorldState={get:()=>({source:'authoritative',world:null})};
 s.events['fa:source-change']();
 assert.equal(s.window.faCompetitionRoute.get().season,'2',
  'Source change with unknown world cannot redirect Season 2 to Season 1');
 assert.equal(s.window.location.search,'?season=2&matchday=9');
 s.window.faWorldState={get:()=>({source:'authoritative',world:{seasonNumber:2}})};
 s.events['fa:source-change']();
 assert.equal(s.window.faCompetitionRoute.get().season,'2','Verified Season 2 stays selected');
 s.window.faWorldState={get:()=>({source:'authoritative',world:{seasonNumber:1}})};
 s.events['fa:source-change']();
 assert.equal(s.window.faCompetitionRoute.get().season,'1','Verified Season 1 redirects future Season 2');
 assert.equal(s.window.location.search,'?season=1&matchday=9');
});

test('DEV season 0 keeps season 1 available without creating a season 0 URL',()=>{
 const s=setup('/competitions/it-1/standings?season=3',3);
 s.window.faCompetitionRoute.setSeasonLimit(0);
 assert.equal(s.window.faCompetitionRoute.get().season,'1');
 assert.equal(s.fields.get('app-competition-season').disabled,false);
 assert.equal(s.fields.get('app-competition-season-value').textContent,'1');
 assert.equal(s.fields.get('app-competition-season-value').attrs['data-app-i18n'],undefined);
 assert.equal(s.fields.get('app-competition-season-unavailable').hidden,true);
 assert.deepEqual(s.fields.get('app-competition-season-menu').options.map(node=>node.dataset.menuValue),['1']);
 assert.equal(s.fields.get('competition-panel-standings').hidden,false);
 assert.equal(s.window.location.search,'?season=1');
 s.window.faCompetitionRoute.setSeasonLimit(1);
 assert.equal(s.fields.get('app-competition-season').disabled,false);
 assert.equal(s.fields.get('competition-panel-standings').hidden,false);
});


test('DEV season 0 survives direct loads and normalizes old season URLs to season 1',()=>{
 for(const slug of ['int-1','int-2',...competitionModel.countries.flatMap(c=>[c.toLowerCase()+'-1',c.toLowerCase()+'-2'])]){
  const s=setup('/competitions/'+slug+'/fixtures?season=3',0);
  assert.equal(s.window.faCompetitionRoute.get().season,'1');
  assert.equal(s.fields.get('app-competition-season').disabled,false);
  assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
  assert.equal(s.fields.get('app-competition-season-value').textContent,'1');
  assert.equal(s.fields.get('app-competition-season-unavailable').hidden,true);
 }
});

test('Explicit invalid season values fall back to season 1 even when later DEV seasons exist',()=>{
 for(const value of ['bad','0','9999999999']){
  const s=setup('/competitions/it-1/fixtures?season='+value+'&matchday=4',3);
  assert.equal(s.window.faCompetitionRoute.get().season,'1');
  assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
 }
});

test('CONTEXT: router updates the shared season through selection, Back and inactive fallback',()=>{
 const s=setup('/competitions/int-1/fixtures?season=2&matchday=4',3);
 assert.equal(s.contextSeasons.at(-1),2);
 s.window.faCompetitionRoute.set({season:'3'});assert.equal(s.contextSeasons.at(-1),3);
 s.back();assert.equal(s.contextSeasons.at(-1),2);
 s.window.faCompetitionRoute.setSeasonLimit(0);assert.equal(s.contextSeasons.at(-1),1);
 assert.equal(views.filter(v=>!s.fields.get('competition-panel-'+v).hidden).length,1);
});

test('COMPETITION-URL: generic first paint preserves cup query views before hydration',()=>{
 const html=readFileSync(new URL('../competitions/int-1/index.html',import.meta.url),'utf8');
 const bootstrap=[...html.matchAll(/<script>(\(\(\)=>[\s\S]*?)<\/script>/g)].slice(0,2).map(match=>match[1]).join('\n');
 const document={documentElement:{dataset:{}}};
 const location={href:'https://example.test/competitions/int-1?view=stats&season=1',pathname:'/competitions/int-1',search:'?view=stats&season=1'};
 runInNewContext(bootstrap,{document,URL,URLSearchParams,history:{replaceState(_a,_b,url){const next=new URL(url,'https://example.test');location.href=next.href;location.pathname=next.pathname;location.search=next.search;}},location});
 assert.equal(document.documentElement.dataset.competitionView,'stats');
});

// Characterization: catches path/query precedence drift without consulting the registry.
const a03Baseline=JSON.parse(readFileSync(new URL('./fixtures/a03-browser-routes.json',import.meta.url),'utf8'));
test('A03-04C: browser URL normalization preserves the frozen domestic and cup oracle',()=>{
 for(const row of a03Baseline.competitionBrowser){
  const s=setup(row.input);
  const groupedLeg=row.matchday==='quarterfinals:2';
   const expectedUrl=groupedLeg?row.expected.replace('quarterfinals%3A2','quarterfinals'):row.expected;
   assert.equal(s.window.location.pathname+s.window.location.search+s.window.location.hash,expectedUrl,row.input);
  assert.deepEqual(JSON.parse(JSON.stringify(s.window.faCompetitionRoute.get())),{season:row.season,view:row.view,matchday:groupedLeg?'quarterfinals:1':row.matchday},row.input);
  assert.equal(s.count(),1,'Initial canonicalization replaces rather than pushes: '+row.input);
 }
});
test('A03-04C: only validated calendar return context survives Fixtures normalization',()=>{
 const valid='/calendar?season=1&day=13&calendarView=week&competition=national&division=it-1';
 for(const value of [valid,'https://outside.test'+valid,'/calendar?season=1&day=57&calendarView=week&competition=national']){
  const s=setup('/competitions/it-1/fixtures?season=1&matchday=7&calendarReturn='+encodeURIComponent(value));
  assert.equal(s.window.location.search,'?'+(value===valid?'calendarReturn='+encodeURIComponent(valid)+'&':'')+'season=1&matchday=7');
 }
});

test('A03-04E: competition navigation uses the real registry while preserving caller query policy',()=>{
 const calls=[];
 const registry=Object.freeze({...routeRegistry,
  parseRoute(path){calls.push('parse');return routeRegistry.parseRoute(path)},
  buildRoute(identity){calls.push('build');return routeRegistry.buildRoute(identity)}});
 const s=setup('/competitions/int-1/fixtures?season=1&matchday=quarterfinals%3A2',null,registry);
 s.window.faCompetitionRoute.set({view:'history'});
 assert.equal(s.window.location.pathname+s.window.location.search,'/competitions/int-1/history?season=1');
 s.back();assert.equal(s.window.location.search,'?season=1&matchday=quarterfinals');
 assert.ok(calls.includes('parse'));assert.ok(calls.includes('build'));
});

test('A03-04E: legacy tab-scroll storage keys remain distinct from canonical path identity',()=>{
 for(const [path,key] of [
  ['/competitions/it-1/fixtures','/competitions/it-1'],
  ['/competitions/it-1/fixtures/','/competitions/it-1'],
  ['/competitions/it-1/','/competitions/it-1/'],
  ['/competitions/it-1/index.html','/competitions/it-1/index.html'],
  ['/competitions/int-1/fixtures','/competitions/int-1']
 ])assert.equal(setup(path).scrollKeys[0],'football-architect:competition-tabs-scroll:'+key,path);
});

test('validated public world updates season choices without changing an explicit historical view',()=>{
 const s=setup('/competitions/it-1/history?season=1');
 assert.equal(s.window.faCompetitionRoute.setPublicSeasonLimit(2),true);
 assert.deepEqual(s.fields.get('app-competition-season-menu').options.map(n=>n.dataset.menuValue),['2','1']);
 assert.equal(s.window.location.search,'?season=1');
 const direct=setup('/competitions/it-1/fixtures?season=2');
 direct.window.faCompetitionRoute.setPublicSeasonLimit(2);
 assert.equal(direct.window.faCompetitionRoute.get().season,'2');
 assert.equal(direct.fields.get('competition-panel-fixtures').hidden,false);
 const latest=setup('/competitions/it-1/standings');
 latest.window.faCompetitionRoute.setPublicSeasonLimit(2,{selectLatest:true});
 assert.equal(latest.window.faCompetitionRoute.get().season,'2');
 latest.window.faCompetitionRoute.setPublicSeasonLimit(0);
 assert.equal(latest.window.faCompetitionRoute.get().season,'1','World reset redirects future Season 2 to permitted Season 1');
 assert.equal(latest.fields.get('competition-panel-standings').hidden,false);
 assert.equal(latest.fields.get('app-competition-season-unavailable').hidden,true);
});

test('PAGE-LOAD-03B P04/P05: 16 canonical domestic shells pre-render their club rows and fixtures',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.divisions.length,16);
 for(const division of manifest.divisions){
  const slug=division.id.toLowerCase(),html=readFileSync(new URL('../competitions/'+slug+'/index.html',import.meta.url),'utf8');
  const tbody=html.match(/<tbody id="app-standings-body">([\s\S]*?)<\/tbody>/)?.[1];
  assert.ok(tbody,'standing body '+slug);
  const rows=[...tbody.matchAll(/<tr data-world-club="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(rows,division.clubs.map(c=>c.countryId+'-'+c.clubId),'16 pre-rendered identities '+slug);
  const standingsSkeleton=html.match(/<div class="app-standings-skeleton" aria-hidden="true">[\s\S]*?<!-- standings-skeleton-end -->/)?.[0];
  assert.ok(standingsSkeleton,'static standings skeleton '+slug);
  const desktopNames=[...standingsSkeleton.matchAll(/class="app-world-club-name">([^<]+)<\/span>/g)].map(m=>m[1]);
  const mobileNames=[...standingsSkeleton.matchAll(/class="app-world-mobile-club-name">([^<]+)<\/span>/g)].map(m=>m[1]);
  const escaped=division.clubs.map(club=>String(club.primaryName||club.abbr).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
  assert.deepEqual(desktopNames,escaped,'all canonical first-paint desktop skeleton identities '+slug);
  assert.deepEqual(mobileNames,escaped,'all canonical first-paint mobile skeleton identities '+slug);

  for(const club of division.clubs){
   const id=club.countryId+'-'+club.clubId,asset=manifest.clubCrests[id];
   const known=!!asset,host='data-club-crest="'+id+'" data-club-crest-pending="true"';
   const hosts=standingsSkeleton.split(host).length-1;
   assert.equal(hosts,known?2:0,'two prepaint crest hosts only for supported club '+id);
   if(known){
    const image='src="/'+asset+'"';
    assert.equal(standingsSkeleton.split(image).length-1,2,'same canonical SVG for desktop/mobile '+id);
    assert.ok(standingsSkeleton.includes('width="48" height="48" loading="eager"'),'desktop crest retains 48px slot');
    assert.ok(standingsSkeleton.includes('width="40" height="40" loading="eager"'),'mobile crest retains 40px slot');
   }
  }

  assert.ok(standingsSkeleton.includes('data-fa-standings-identity-first-paint'),'pre-paint season safety gate '+slug);
  assert.equal((standingsSkeleton.match(/data-skeleton-identity-placeholder/g)||[]).length,32,'masked alternative for unknown season '+slug);

  const choices=[...html.matchAll(/data-fixture-round-choice="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(choices.slice(0,30),Array.from({length:30},(_,i)=>String(i+1)),'matchdays '+slug);
  assert.equal(choices.length,31,'30 rounds plus one postseason '+slug);
  assert.equal(choices[30],division.tier===1?'playout':'playoffs','postseason Model C '+slug);
  const skeleton=html.match(/<ol id="app-fixtures-skeleton"[\s\S]*?<\/ol>/)?.[0]||'';
  assert.equal((skeleton.match(/data-skeleton-fixture\b/g)||[]).length,8,'8 reserved cards '+slug);
  for(const id of ['app-competition-season','app-fixtures-round-number','app-fixtures-previous','app-fixtures-next','competition-tab-standings','competition-tab-fixtures'])
   assert.ok(html.includes('id="'+id+'"'),'static '+id+' '+slug);
 }
});
test('PAGE-LOAD-03B: a confirmed broken manifest must not destroy the static competition shell',()=>{
 const source=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
 for(const token of ['shell.insertBefore(notice','notice.dataset.competitionLoadError','faStandingsLoading?.set','getElementById(\'app-fixtures-empty\')'])
  assert.ok(source.includes(token),token);
});

test('PAGE-LOAD-03B: neutral skeleton reserves 16 ranked slots until season data arrives',()=>{
 const renderer=readFileSync(new URL('../tools/render-competition-page.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 const runtime=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
 assert.ok(renderer.includes('season==="1"?"true":"false"'),'explicit S1 only at prepaint');
 assert.ok(runtime.includes("context.definition.category==='domestic'&&context.selectedSeason===1"),'source/season transition updates identity visibility');
 assert.ok(css.includes('.app-standings-skeleton [data-skeleton-identity]{display:none;min-width:0;align-items:center}'),'catalog ID order hidden until ranking is known');
 assert.ok(css.includes('.app-standings-skeleton [data-skeleton-identity-placeholder]{display:flex;align-items:center;background:transparent;margin:0}'),'neutral skeleton identities reserve space');
 assert.ok(css.includes('.app-standings-skeleton tr>:nth-child(2) :is([data-skeleton-identity-placeholder],.app-skeleton-bar)::before{'),'desktop reserves the same crest track for domestic and international');
 assert.ok(css.includes('.app-standings-skeleton .app-world-mobile-name:is([data-skeleton-identity-placeholder],.app-skeleton-bar)::before{'),'mobile reserves the same crest track for domestic and international');
 assert.ok(!css.includes('html[data-fa-standings-known-identity="true"] .app-standings-skeleton [data-skeleton-identity]'),'unknown ranking never shows catalog order');
 assert.ok(css.includes('#competition-panel-standings>.app-world-standings{position:absolute;inset-inline:0;top:0;visibility:hidden;pointer-events:none}'),'previous sporting data remains hidden during loading');
 assert.ok(css.includes('#competition-panel-standings :is(.app-world-club-name,.app-world-mobile-club-name){font-weight:700}'),'club-name bold typography');
 assert.ok(!css.includes('[data-skeleton-identity]{display:none;min-width:0;gap:7px'),'skeleton inherits the loaded desktop/mobile crest-to-name gap');
 assert.ok(css.includes('.app-standings-skeleton [data-club-crest-pending="true"]>.app-club-crest-image{visibility:visible}'),'known icon visible with no interim shield');

});
