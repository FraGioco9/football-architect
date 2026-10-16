import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createPreviewStandings} from '../tools/dev-standings-preview-data.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const divisions=JSON.parse(read('app/competitions/_shared/manifest.json')).divisions;

test('FIXTURES-01: all sixteen routes contain labeled 1–30 navigation and an honest empty state',()=>{
 for(const d of divisions){
  const html=read('app/competitions/'+d.id.toLowerCase()+'/index.html');
  assert.ok(html.includes('id="app-fixtures-round"'),d.id);
  assert.ok(html.includes('aria-controls="app-fixtures-picker"'),d.id);
  assert.equal((html.match(/data-fixture-round-choice="\d+"/g)||[]).length,30,d.id);
  assert.ok(html.includes('id="app-fixtures-list"'),d.id);
  assert.ok(html.includes('id="app-fixtures-empty"'),d.id);
  assert.ok(html.includes('aria-live="polite"'),d.id);
  assert.ok(!html.includes('data-fixture-match='),d.id+' has no fabricated public matches');
 }
});

function node(tag='div'){
 const n={tagName:tag,children:[],dataset:{},attrs:{},events:{},textContent:'',value:'1',disabled:true,hidden:false,
  append(...items){this.children.push(...items)},appendChild(item){this.children.push(item);return item},
  replaceChildren(...items){this.children=[...items]},removeAttribute(k){delete this.attrs[k]},setAttribute(k,v){this.attrs[k]=String(v)},
  focus(){this.focused=true},contains(){return false},addEventListener(k,fn){this.events[k]=fn},emit(k){this.events[k]?.({target:this})}};
 return n;
}
function setup(d=divisions[0]){
 const fields=new Map(['current','round','previous','next','list','empty','summary','picker','round-number'].map(id=>['app-fixtures-'+id,node()]));
 const choices=Array.from({length:30},(_,i)=>({...node('button'),id:"app-fixtures-round-option-"+(i+1),dataset:{fixtureRoundChoice:String(i+1),menuValue:String(i+1)}}));
 fields.get('app-fixtures-picker').querySelectorAll=()=>choices;
 let state={season:'1',view:'fixtures',matchday:1};const listeners=[];
 const route={get:()=>state,subscribe:fn=>listeners.push(fn),set(patch){if(patch.matchday!==undefined&&(!Number.isInteger(patch.matchday)||patch.matchday<1||patch.matchday>30))return;state={...state,...patch};listeners.forEach(fn=>fn(state))}};
 const window={faCompetitionDivision:d,faCompetitionRoute:route,faAppRenderLanguage(){}};
 const document={querySelector:selector=>selector===".app-fixtures-select"?node():null,addEventListener(){},documentElement:{lang:'en'},getElementById:id=>fields.get(id),createElement:tag=>node(tag)};
 runInNewContext(read('assets/competition-tabs.js'),{window,document});
 runInNewContext(read('assets/competition-fixtures.js'),{window,document,Intl,Date,MutationObserver:class{observe(){}}});
 return {view:window.faFixtures,fields,route,choices};
}
const schedule=(d,played=15)=>createPreviewStandings(d,30).fixtures.map(f=>({...f,kickoff:null,
 homeGoals:f.round<=played?f.homeGoals:null,awayGoals:f.round<=played?f.awayGoals:null}));
const contents=n=>n.textContent+n.children.map(contents).join(' ');

test('FIXTURES-02: eight games per round, stable navigation and real score/null distinctions across every division',()=>{
 for(const d of divisions){
  const {view,fields,route}=setup(d),round=fields.get('app-fixtures-round'),list=fields.get('app-fixtures-list');
  assert.equal(fields.get('app-fixtures-empty').hidden,false);
  const fixtures=schedule(d);fixtures.find(f=>f.round===1).homeGoals=0;fixtures.find(f=>f.round===1).awayGoals=0;
  const commit=view.prepare(fixtures);assert.equal(list.children.length,0,'preparation is detached');commit();
  assert.equal(list.children.length,8);assert.equal(round.disabled,false);
  assert.equal(fields.get('app-fixtures-previous').disabled,true);
  assert.ok(contents(list).includes('0 – 0'),'zero is a played score');
  route.set({matchday:16});
  assert.equal(list.children.length,8);assert.ok(list.children.every(x=>x.dataset.fixtureRound==='16'));
  assert.ok(!contents(list).includes(' – '),'future fixtures do not reveal generated future scores');
  fields.get('app-fixtures-next').emit('click');assert.equal(round.value,'17');
  route.set({matchday:30});assert.equal(fields.get('app-fixtures-next').disabled,true);
  fields.get('app-fixtures-next').emit('click');assert.equal(round.value,'30');
  const restore=view.snapshot();view.prepare(null)();assert.equal(list.children.length,0);restore();
  assert.equal(list.children.length,8);assert.equal(round.value,'30');
 }
});

test('FIXTURES-03: invalid and incomplete schedules never replace valid rendered matches',()=>{
 const d=divisions[0],{view,fields,route}=setup(d),fixtures=schedule(d);
 view.prepare(fixtures)();const previous=fields.get('app-fixtures-list').children;
 const bad=[fixtures.slice(1),[...fixtures,fixtures[0]],fixtures.map((f,i)=>i?f:{...f,homeId:40}),
  fixtures.map((f,i)=>i?f:{...f,round:31}),fixtures.map((f,i)=>i?f:{...f,awayGoals:null}),
  fixtures.map((f,i)=>i?f:{...f,homeGoals:-1}),fixtures.map((f,i)=>i?f:{...f,kickoff:'2026-10-20T12:00:00'}),
  fixtures.map((f,i)=>i?f:{...f,kickoff:'2026-99-99T12:00:00Z'}),
  fixtures.map((f,i)=>i?f:{...f,kickoff:'2026-02-30T12:00:00Z'}),
  fixtures.map((f,i)=>i?f:{...f,kickoff:'2026-10-20T24:00:00Z'}),fixtures.map((f,i)=>i?f:{...f,awayId:f.homeId})];
 for(const data of bad){assert.throws(()=>view.prepare(data));assert.equal(fields.get('app-fixtures-list').children,previous);}
});

test('FIXTURES-04: names are plain text, timing stays unknown unless supplied and selected rounds survive updates',()=>{
 const d=structuredClone(divisions[0]);d.clubs[0].primaryName='<img src=x onerror=alert(1)>';
 const {view,fields,route}=setup(d),fixtures=schedule(d),round=fields.get('app-fixtures-round');
 fixtures.find(f=>f.round===1).kickoff='2026-10-20T12:30:00Z';
 view.prepare(fixtures)();assert.ok(contents(fields.get('app-fixtures-list')).includes('<img src=x onerror=alert(1)>'));
 const walk=n=>[n,...n.children.flatMap(walk)];
 assert.equal(walk(fields.get('app-fixtures-list')).filter(n=>n.tagName==='img').length,0);
 assert.equal(walk(fields.get('app-fixtures-list')).filter(n=>n.tagName==='time').length,1);
 route.set({matchday:23});view.prepare(schedule(d,30))();assert.equal(round.value,'23');
 route.set({matchday:NaN});assert.equal(round.value,'23');
});

test('FIXTURES-05: return to supplied current round is conditional, transactional and preserves selected round',()=>{
 const {view,fields,route}=setup(),button=fields.get('app-fixtures-current');
 assert.equal(button.hidden,true);
 view.prepare(schedule(divisions[0]),{currentMatchday:16})();
 assert.equal(button.hidden,false);
 button.emit('click');assert.equal(route.get().matchday,16);assert.equal(button.hidden,true);
 assert.equal(fields.get('app-fixtures-round').focused,true);
 route.set({matchday:12});assert.equal(button.hidden,false);
 const restore=view.snapshot();view.prepare(null)();assert.equal(button.hidden,true);
 restore();button.emit('click');assert.equal(route.get().matchday,16);
 for(const invalid of [0,31,NaN,'16'])assert.throws(()=>view.prepare(schedule(divisions[0]),{currentMatchday:invalid}));
 route.set({season:'2'});assert.equal(button.hidden,true);
 route.set({season:'1'});view.prepare(schedule(divisions[0]))();assert.equal(button.hidden,true,'unknown current round is never inferred');
 for(const currentMatchday of [1,30]){
  view.prepare(schedule(divisions[0],currentMatchday===1?0:30),{currentMatchday})();
  button.emit('click');assert.equal(route.get().matchday,currentMatchday);assert.equal(button.hidden,true);
 }
});
