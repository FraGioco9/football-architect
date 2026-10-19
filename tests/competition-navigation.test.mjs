import competitionModel from "../assets/competition-model.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../assets/competition-tabs.js',import.meta.url),'utf8');
const views=['standings','postseason','fixtures','stats','history','rules','awards'];
function setup(path='/competitions/it-1/',devSeason=null){
 const fields=new Map(),events={},stack=[new URL(path,'https://example.test')];let cursor=0;
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
 const document={addEventListener(){},documentElement:{dataset:devSeason?{faDevSeasons:'1,2,3,4',faDevCurrentSeason:String(devSeason)}:{}},getElementById:id=>fields.get(id),querySelector:()=>tablist,
 createElement(){const node=item();node.remove=()=>{menu.options=menu.options.filter(item=>item!==node)};return node}};
 const window={faCompetitionModel:competitionModel,get location(){return stack[cursor]},history:{
  replaceState(a,b,url){stack[cursor]=new URL(url,stack[cursor])},
  pushState(a,b,url){stack.splice(cursor+1);stack.push(new URL(url,stack[cursor]));cursor++}},
  dispatchEvent(){},addEventListener(k,fn){events[k]=fn}};
 runInNewContext(source,{document,window,URL,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}});
 return {window,tabs,fields,tablist,events,back(){cursor--;events.popstate()},forward(){cursor++;events.popstate()},count:()=>stack.length};
}
test('DEV season menu ends at current progress and moves an invalid viewed season to the latest available',()=>{
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
test('DEV future deep links normalize to the latest current season',()=>{
 const s=setup('/competitions/it-1?season=4&view=stats',2);
 assert.equal(s.window.faCompetitionRoute.get().season,'2');
 assert.equal(s.fields.get('competition-panel-stats').hidden,false);
});
test('COMPETITION-URL: canonical deep links restore every view, round and browser history',()=>{
 const s=setup('/competitions/it-1/?season=1&view=fixtures&matchday=12');
 assert.equal(s.window.location.pathname,'/competitions/it-1');
 assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
 assert.equal(s.window.faCompetitionRoute.get().matchday,12);
 s.window.faCompetitionRoute.set({matchday:13});
 assert.equal(s.window.location.search,'?season=1&view=fixtures&matchday=13');
 s.tabs[3].events.click();assert.equal(s.window.location.search,'?season=1&view=stats');
 s.back();assert.equal(s.window.faCompetitionRoute.get().matchday,13);assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
 s.back();assert.equal(s.window.faCompetitionRoute.get().matchday,12);
 s.forward();assert.equal(s.window.faCompetitionRoute.get().matchday,13);
 for(let i=0;i<views.length;i++){s.tabs[i].events.click();assert.equal(s.window.faCompetitionRoute.get().view,views[i]);assert.equal([...s.fields].filter(([id,p])=>id.startsWith('competition-panel-')&&!p.hidden).length,1);}
});
test('COMPETITION-URL: invalid parameters normalize, unavailable seasons never show another season',()=>{
 const s=setup('/competitions/it-1/index.html?season=bad&view=unknown&matchday=999');
 assert.equal(s.window.location.pathname,'/competitions/it-1');
 assert.equal(s.window.location.search,'?season=1&view=standings');assert.equal(s.count(),1);
 const missing=setup('/competitions/it-1?season=2&view=fixtures&matchday=4');
 assert.equal(missing.window.faCompetitionRoute.get().season,'2');
 assert.equal(missing.fields.get('app-competition-season-unavailable').hidden,false);
 assert.equal(views.every(v=>missing.fields.get('competition-panel-'+v).hidden),true);
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

test('COMPETITION-URL: first paint hides unavailable seasons and unrelated views',()=>{
 const html=readFileSync(new URL('../app/competitions/it-1/index.html',import.meta.url),'utf8');
 const bootstrap=html.match(/<script>(\(\(\)=>[\s\S]*?)<\/script>/)[1];
 for(const season of ['1','2','12','999999999']){
  const document={addEventListener(){},documentElement:{dataset:{}}};
  runInNewContext(bootstrap,{document,URLSearchParams,location:{search:'?season='+season+'&view=fixtures&matchday=12'}});
  assert.equal(document.documentElement.dataset.competitionView,'fixtures');
  assert.equal(document.documentElement.dataset.competitionSeasonUnavailable,String(season!=='1'));
 }
});

test('COMPETITION-URL: matchday is scoped to Fixtures URLs while tab changes retain the in-page selection',()=>{
 const s=setup('/competitions/it-1?season=1&view=fixtures&matchday=12');
 s.tabs[0].events.click();
 assert.equal(s.window.location.search,'?season=1&view=standings');
 const refreshed=setup(s.window.location.href);
 refreshed.tabs[2].events.click();
 assert.equal(refreshed.window.faCompetitionRoute.get().matchday,1);
 assert.equal(refreshed.window.location.search,'?season=1&view=fixtures&matchday=1');
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
 const s=setup('/competitions/it-1?season=1&view=history');
 s.window.faCompetitionRoute.set({season:'1',view:'standings'},{focus:true});
 assert.equal(s.window.location.search,'?season=1&view=standings');
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
