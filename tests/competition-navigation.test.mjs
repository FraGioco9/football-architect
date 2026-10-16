import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../assets/competition-tabs.js',import.meta.url),'utf8');
const views=['standings','fixtures','stats','history','rules','awards'];
function setup(path='/app/competitions/it-1/'){
 const fields=new Map(),events={},stack=[new URL(path,'https://example.test')];let cursor=0;
 const item=()=>({hidden:false,value:'',dataset:{},events:{},attrs:{},classList:{toggle(){}},
  setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this.events[k]=fn},focus(){this.focused=true},scrollIntoView(){}});
 const tabs=views.map(view=>{const tab=item();tab.id='competition-tab-'+view;tab.getAttribute=()=> 'competition-panel-'+view;fields.set('competition-panel-'+view,item());return tab});
 fields.set('app-competition-season',item());fields.set('app-competition-season-unavailable',item());
 const document={documentElement:{dataset:{}},getElementById:id=>fields.get(id),querySelector:()=>({querySelectorAll:()=>tabs})};
 const window={get location(){return stack[cursor]},history:{
  replaceState(a,b,url){stack[cursor]=new URL(url,stack[cursor])},
  pushState(a,b,url){stack.splice(cursor+1);stack.push(new URL(url,stack[cursor]));cursor++}},
  addEventListener(k,fn){events[k]=fn}};
 runInNewContext(source,{document,window,URL});
 return {window,tabs,fields,back(){cursor--;events.popstate()},forward(){cursor++;events.popstate()},count:()=>stack.length};
}
test('COMPETITION-URL: canonical deep links restore every view, round and browser history',()=>{
 const s=setup('/app/competitions/it-1/?season=1&view=fixtures&matchday=12');
 assert.equal(s.window.location.pathname,'/app/competitions/it-1');
 assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
 assert.equal(s.window.faCompetitionRoute.get().matchday,12);
 s.window.faCompetitionRoute.set({matchday:13});
 assert.equal(s.window.location.search,'?season=1&view=fixtures&matchday=13');
 s.tabs[2].events.click();assert.equal(s.window.location.search,'?season=1&view=stats');
 s.back();assert.equal(s.window.faCompetitionRoute.get().matchday,13);assert.equal(s.fields.get('competition-panel-fixtures').hidden,false);
 s.back();assert.equal(s.window.faCompetitionRoute.get().matchday,12);
 s.forward();assert.equal(s.window.faCompetitionRoute.get().matchday,13);
 for(let i=0;i<views.length;i++){s.tabs[i].events.click();assert.equal(s.window.faCompetitionRoute.get().view,views[i]);assert.equal([...s.fields].filter(([id,p])=>id.startsWith('competition-panel-')&&!p.hidden).length,1);}
});
test('COMPETITION-URL: invalid parameters normalize, unavailable seasons never show another season',()=>{
 const s=setup('/app/competitions/it-1/index.html?season=bad&view=unknown&matchday=999');
 assert.equal(s.window.location.pathname,'/app/competitions/it-1');
 assert.equal(s.window.location.search,'?season=1&view=standings');assert.equal(s.count(),1);
 const missing=setup('/app/competitions/it-1?season=2&view=fixtures&matchday=4');
 assert.equal(missing.window.faCompetitionRoute.get().season,'2');
 assert.equal(missing.fields.get('app-competition-season-unavailable').hidden,false);
 assert.equal(views.every(v=>missing.fields.get('competition-panel-'+v).hidden),true);
 missing.fields.get('app-competition-season').value='1';missing.fields.get('app-competition-season').events.change();
 assert.equal(missing.fields.get('competition-panel-fixtures').hidden,false);
});
test('COMPETITION-URL: keyboard navigation retains one active tab and does not duplicate history entries',()=>{
 const s=setup();let prevented=false;
 s.tabs[0].events.keydown({key:'ArrowLeft',preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(s.tabs[5].focused,true);assert.equal(s.window.faCompetitionRoute.get().view,'awards');
 const count=s.count();s.tabs[5].events.click();assert.equal(s.count(),count);
 s.tabs[5].events.keydown({key:'Home',preventDefault(){}});assert.equal(s.fields.get('competition-panel-standings').hidden,false);
});

test('COMPETITION-URL: first paint hides unavailable seasons and unrelated views',()=>{
 const html=readFileSync(new URL('../app/competitions/it-1/index.html',import.meta.url),'utf8');
 const bootstrap=html.match(/<script>(\(\(\)=>[\s\S]*?)<\/script>/)[1];
 for(const season of ['1','2','12','999999999']){
  const document={documentElement:{dataset:{}}};
  runInNewContext(bootstrap,{document,URLSearchParams,location:{search:'?season='+season+'&view=fixtures&matchday=12'}});
  assert.equal(document.documentElement.dataset.competitionView,'fixtures');
  assert.equal(document.documentElement.dataset.competitionSeasonUnavailable,String(season!=='1'));
 }
});
