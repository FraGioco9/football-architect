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
function setup(path='/competitions/it-1/',devSeason=null){
 const contextSeasons=[];const fields=new Map(),events={},stack=[new URL(path,'https://example.test')];let cursor=0;
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
 const window={faCompetitionRules:rules,faCompetitionContext:definition?{definition}:null,faCompetitionContextApi:{selectSeason:season=>contextSeasons.push(Number(season))},faCompetitionModel:competitionModel,get location(){return stack[cursor]},history:{
  replaceState(a,b,url){stack[cursor]=new URL(url,stack[cursor])},
  pushState(a,b,url){stack.splice(cursor+1);stack.push(new URL(url,stack[cursor]));cursor++}},
  dispatchEvent(){},addEventListener(k,fn){events[k]=fn}};
 runInNewContext(source,{document,window,URL,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}});
 return {window,tabs,fields,tablist,events,contextSeasons,back(){cursor--;events.popstate()},forward(){cursor++;events.popstate()},count:()=>stack.length};
}
test('CONFIG-URL: cup routes reject domestic rounds and retain configured leg tokens through history',()=>{
 const s=setup('/competitions/int-1/fixtures?season=1&matchday=30');
 assert.equal(s.window.faCompetitionRoute.get().matchday,1);
 s.window.faCompetitionRoute.set({matchday:'quarterfinals:2'});
 assert.equal(s.window.faCompetitionRoute.get().matchday,'quarterfinals:2');
 s.window.faCompetitionRoute.set({matchday:'final:1'});s.back();
 assert.equal(s.window.faCompetitionRoute.get().matchday,'quarterfinals:2');
 s.window.faCompetitionRoute.set({matchday:'playout'});
 assert.equal(s.window.faCompetitionRoute.get().matchday,'quarterfinals:2');
});
test('DEV season menu ends at current progress and moves an invalid viewed season to season 1',()=>{
 const s=setup('/competitions/it-1?season=3&view=fixtures&matchday=13',3);
 const menu=s.fields.get('app-competition-season-menu');
 assert.deepEqual(menu.options.map(node=>node.dataset.menuValue),['3','2','1']);
 s.window.faCompetitionRoute.setSeasonLimit(2);
 assert.deepEqual(menu.options.map(node=>node.dataset.menuValue),['2','1']);
 assert.deepEqual(JSON.parse(JSON.stringify(s.window.faCompetitionRoute.get())),{season:'1',view:'fixtures',matchday:13});
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
test('DEV future deep links normalize to season 1',()=>{
 const s=setup('/competitions/it-1?season=4&view=stats',2);
 assert.equal(s.window.faCompetitionRoute.get().season,'1');
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
test('COMPETITION-URL: invalid parameters and unavailable seasons normalize to season 1',()=>{
 const s=setup('/competitions/it-1/index.html?season=bad&view=unknown&matchday=999');
 assert.equal(s.window.location.pathname,'/competitions/it-1/standings');
 assert.equal(s.window.location.search,'?season=1');assert.equal(s.count(),1);
 const missing=setup('/competitions/it-1?season=2&view=fixtures&matchday=4');
 assert.equal(missing.window.faCompetitionRoute.get().season,'1');
 assert.equal(missing.fields.get('app-competition-season-unavailable').hidden,true);
 assert.equal(missing.fields.get('competition-panel-fixtures').hidden,false);
 missing.fields.get('app-competition-season-option-1').events.click();
 assert.equal(missing.fields.get('competition-panel-fixtures').hidden,false);
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
 s.tablist.scrollLeft=0;s.events.resize();assert.ok(s.tablist.scrollLeft>0,'resize reveals selected tab');
 s.tablist.clientWidth=700;s.tablist.scrollWidth=620;s.tablist.scrollLeft=0;s.tablist.events.scroll();
 assert.equal(s.tablist.dataset.canScrollLeft,'false');assert.equal(s.tablist.dataset.canScrollRight,'false');
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

test('ROUTE-02 History and Rules URLs omit season while other competition views retain it',()=>{
 const s=setup('/competitions/it-1/standings?season=1');
 s.window.faCompetitionRoute.set({view:'history'});
 assert.equal(s.window.location.pathname,'/competitions/it-1/history');
 assert.equal(s.window.location.search,'');
 s.window.faCompetitionRoute.set({view:'rules'});
 assert.equal(s.window.location.pathname,'/competitions/it-1/rules');
 assert.equal(s.window.location.search,'');
 s.window.faCompetitionRoute.set({view:'fixtures',matchday:9});
 assert.equal(s.window.location.pathname,'/competitions/it-1/fixtures');
 assert.equal(s.window.location.search,'?season=1&matchday=9');
 const direct=setup('/competitions/it-1/history?season=4');
 assert.equal(direct.window.location.pathname,'/competitions/it-1/history');
 assert.equal(direct.window.location.search,'');
});

test('All competition routes fall back to season 1 without hiding the requested view',()=>{
 for(const slug of ['int-1','int-2',...competitionModel.countries.flatMap(c=>[c.toLowerCase()+'-1',c.toLowerCase()+'-2'])]){
  for(const dev of [null,3]){
   const s=setup('/competitions/'+slug+'/fixtures?season=99&matchday=4',dev);
   assert.equal(s.window.faCompetitionRoute.get().season,'1');
   assert.equal(s.window.faCompetitionRoute.get().view,'fixtures');
   assert.equal(s.window.faCompetitionRoute.get().matchday,4);
   assert.equal(s.window.location.search,'?season=1&matchday=4');
   assert.equal(s.fields.get('app-competition-season-unavailable').hidden,true);
   assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
   s.window.faCompetitionRoute.set({season:'99'});
   assert.equal(s.window.faCompetitionRoute.get().season,'1');
  }
  const preview=setup('/competitions/'+slug+'/standings?season=3',3);
  assert.equal(preview.window.faCompetitionRoute.get().season,'3');
  preview.window.faCompetitionRoute.setSeasonLimit(2);
  assert.equal(preview.window.faCompetitionRoute.get().season,'1');
 }
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
