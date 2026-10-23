import competitionModel from "../assets/competition-model.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createPreviewStandings,createPreviewPostseason} from '../tools/dev-standings-preview-data.mjs';
import rules from '../assets/competition-rules.js';
import calendarModel from '../assets/world-calendar-model.js';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const definitions=loadCompetitionCatalogue();
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const divisions=JSON.parse(read('competitions/_shared/manifest.json')).divisions;

test('CONFIG-CLOCK: current fixture choices use existing markers without extending the 56-day clock',()=>{
 assert.equal(typeof rules.currentFixtureChoice,'function');
 const calendar=calendarModel.createSeason(1),cup=definitions.find(d=>d.id==='int-1');
 for(const [day,want] of [[1,1],[16,2],[31,'playoffs:1'],[36,'playoffs:2'],[48,'final:1'],[54,null],[56,null]])assert.equal(rules.currentFixtureChoice(cup,calendar,{current:{season:1,day}}),want);
 assert.equal(rules.currentFixtureChoice(cup,calendar,null),null);
 assert.equal(rules.currentFixtureChoice(cup,calendar,{current:{season:2,day:1}}),null);
});

test('CONFIG-PHASES: fixture choices derive domestic and international phase lengths',()=>{
 assert.equal(typeof rules.fixtureChoices,'function');
 assert.deepEqual(rules.fixtureChoices(definitions.find(d=>d.id==='IT-1')).map(c=>c.value),[...Array.from({length:30},(_,i)=>i+1),'playout']);
 assert.equal(rules.fixtureChoices(definitions.find(d=>d.id==='IT-2')).at(-1).value,'playoffs');
 for(const d of definitions.filter(d=>d.category==='international')){
  const choices=rules.fixtureChoices(d);
  assert.deepEqual(choices.map(c=>c.value),[1,2,3,4,5,6,'playoffs:1','playoffs:2','quarterfinals:1','quarterfinals:2','semifinals:1','semifinals:2','final:1']);
  const html=read('competitions/'+d.slug+'/index.html');
  assert.equal((html.match(/data-fixture-round-choice="\d+"/g)||[]).length,6);
  assert.ok(html.includes('data-fixture-round-choice="final:1"'));
  assert.equal((html.match(/data-postseason-config-tie=/g)||[]).length,11);
  assert.ok(!html.includes('data-standing-outcome="promoted"'));
 }
});

test('FIXTURES-01: all sixteen routes contain labeled 1–30 navigation and an honest empty state',()=>{
 for(const d of divisions){
  const html=read('competitions/'+d.id.toLowerCase()+'/index.html');
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
 const definition=definitions.find(item=>item.id===d.id),configured=rules.fixtureChoices(definition);
 const fields=new Map(['toolbar','current','round','previous','next','list','empty','summary','picker','round-number','round-label'].map(id=>['app-fixtures-'+id,node()]));
 const choices=configured.map(c=>({...node('button'),id:"app-fixtures-round-option-"+c.value,dataset:{fixtureRoundChoice:String(c.value),menuValue:String(c.value)}}));
 fields.get('app-fixtures-picker').querySelectorAll=()=>choices;
 let state={season:'1',view:'fixtures',matchday:1};const listeners=[];
 const route={get:()=>state,subscribe:fn=>listeners.push(fn),defaultMatchday(){},set(patch,options){if(patch.matchday!==undefined&&!configured.some(c=>c.value===patch.matchday))return;state={...state,...patch};listeners.forEach(fn=>fn(state))}};
 const events={};const window={faCompetitionRules:rules,faCompetitionContext:{definition,seasonData:null},faCompetitionModel:competitionModel,faCompetitionDivision:definition.category==='domestic'?d:null,faCompetitionRoute:route,faAppRenderLanguage(){},addEventListener(k,fn){events[k]=fn}};
 const document={querySelector:selector=>selector===".app-fixtures-select"?node():null,addEventListener(){},documentElement:{lang:'en',dataset:{faDevSeasons:'2,3,4'}},getElementById:id=>fields.get(id),createElement:tag=>node(tag)};
 runInNewContext(read('assets/competition-tabs.js'),{window,document});
 runInNewContext(read('assets/competition-fixtures.js'),{window,document,Intl,Date,MutationObserver:class{observe(){}}});
 return {view:window.faFixtures,fields,route,choices,window,events};
}
const schedule=(d,played=15)=>createPreviewStandings(d,30).fixtures.map(f=>({...f,kickoff:null,
 homeGoals:f.round<=played?f.homeGoals:null,awayGoals:f.round<=played?f.awayGoals:null}));
const contents=n=>n.textContent+n.children.map(contents).join('');

test('CONFIG-FIXTURES: supplied cup matches keep composite IDs and browsing does not alter context',()=>{
 const cup=definitions.find(d=>d.id==='int-1'),r=setup(cup);
 assert.equal(typeof r.view?.prepare,'function');
 const participants=Array.from({length:24},(_,i)=>({countryId:['IT','ENG','ES'][Math.floor(i/8)],clubId:i%8+1,primaryName:'Club '+i}));
 const fixtures=Array.from({length:12},(_,i)=>({phaseId:'league',round:1,homeId:rules.clubKey(participants[i]),awayId:rules.clubKey(participants[i+12]),homeGoals:null,awayGoals:null,kickoff:null}));
 const context={definition:cup,selectedSeason:1,revision:2,seasonData:{participants,fixtures,results:null,statistics:null,status:'partial'}};
 r.window.faCompetitionContext=context;r.events['fa:competition-context-change']();
 assert.equal(r.fields.get('app-fixtures-list').children.length,12);
 assert.ok(contents(r.fields.get('app-fixtures-list')).includes('Club 0'));
 r.route.set({matchday:'quarterfinals:2'});
 assert.equal(r.window.faCompetitionContext,context);
 assert.equal(r.fields.get('app-fixtures-list').children.length,0,'unavailable later fixtures stay empty');
 assert.equal(r.fields.get('app-fixtures-empty').hidden,false,'selected unsupplied choice explains its empty state');
 r.window.faCompetitionContext={...context,selectedSeason:2,seasonData:null};r.events['fa:competition-context-change']();
 assert.equal(r.fields.get('app-fixtures-list').children.length,0);
 assert.equal(r.fields.get('app-fixtures-toolbar').hidden,true);
});
test('CONFIG-FIXTURES-INVALID: duplicate tie/leg and unresolved or misseeded knockout fixtures fail closed',()=>{
 const cup=definitions.find(d=>d.id==='int-1'),r=setup(cup);
 const participants=Array.from({length:24},(_,i)=>({countryId:['IT','ENG','ES'][Math.floor(i/8)],clubId:i%8+1,primaryName:'Club '+i}));
 const id=i=>rules.clubKey(participants[i]);
 const standings=participants.map(club=>({club,played:6}));
 const game={phaseId:'quarterfinals',tieId:'q1',leg:1,homeId:id(8),awayId:id(0),homeGoals:null,awayGoals:null,kickoff:null};
 const result={id:'p89',winnerId:id(8)};
 const cases=[{fixtures:[game,{...game,homeId:id(9)}],statistics:{standings},results:[result]},
  {fixtures:[game,{...game,round:99}],statistics:{standings},results:[result]},
  {fixtures:[game],statistics:null,results:[]},
  {fixtures:[{...game,homeId:id(0),awayId:id(8)}],statistics:{standings},results:[result]}];
 for(const variant of cases){
  r.window.faCompetitionContext={definition:cup,selectedSeason:1,seasonData:{participants,...variant}};
  r.events['fa:competition-context-change']();r.route.set({matchday:'quarterfinals:1'});
  assert.equal(r.fields.get('app-fixtures-list').children.length,0);
  assert.equal(r.fields.get('app-fixtures-toolbar').hidden,true);
 }
});
test('SEASON-FIXTURES: accepted historical seeds replace the definition captured at mount',()=>{
 const cup=definitions.find(d=>d.id==='int-1'),r=setup(cup),historical=structuredClone(cup);
 // The current catalogue differs from the stored snapshot's seed pairing.
 historical.rules.phases.find(p=>p.id==='playoffs').ties[0].participants[0].rank=6;
 const participants=Array.from({length:24},(_,i)=>({countryId:['IT','ENG','ES'][Math.floor(i/8)],clubId:i%8+1,primaryName:'Club '+i}));
 const id=i=>rules.clubKey(participants[i]);
 const game={phaseId:'playoffs',tieId:'p512',leg:1,homeId:id(11),awayId:id(5),homeGoals:1,awayGoals:0,kickoff:null};
 r.window.faCompetitionContext={definition:rules.normalizeCompetition(historical),selectedSeason:1,seasonData:{participants,fixtures:[game],results:[],statistics:{standings:participants.map(club=>({club,played:6}))}}};
 r.events['fa:competition-context-change']();r.route.set({matchday:'playoffs:1'});
 assert.equal(r.fields.get('app-fixtures-toolbar').hidden,false);
 assert.equal(r.fields.get('app-fixtures-list').children.length,1);
});

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
  route.set({matchday:30});assert.equal(fields.get('app-fixtures-next').disabled,false);
  fields.get('app-fixtures-next').emit('click');assert.equal(route.get().matchday,d.tier===1?'playout':'playoffs');
   route.set({matchday:30});
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
 assert.equal(walk(fields.get('app-fixtures-list')).filter(n=>n.tagName==='time').length,0);
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
 route.set({season:'5'});assert.equal(button.hidden,true,'unavailable season hides return-to-current-round control');
 route.set({season:'1'});view.prepare(schedule(divisions[0]))();assert.equal(button.hidden,true,'unknown current round is never inferred');
 for(const currentMatchday of [1,30]){
  view.prepare(schedule(divisions[0],currentMatchday===1?0:30),{currentMatchday})();
  button.emit('click');assert.equal(route.get().matchday,currentMatchday);assert.equal(button.hidden,true);
 }
});


test('FIXTURES-06: matchday controls stay hidden without a schedule and recover with available rounds',()=>{
 const {view,fields,route}=setup(),toolbar=fields.get('app-fixtures-toolbar');
 assert.equal(toolbar.hidden,true,'initial public empty state');
 view.prepare(schedule(divisions[0],0))();
 assert.equal(toolbar.hidden,false,'unplayed scheduled rounds still provide navigation');
 route.set({season:'2'});assert.equal(toolbar.hidden,false,'DEV season 2 retains navigation');
 route.set({season:'3'});assert.equal(toolbar.hidden,false,'DEV season 3 retains navigation');
 route.set({season:'4'});assert.equal(toolbar.hidden,false,'DEV season 4 retains navigation');
 route.set({season:'5'});assert.equal(toolbar.hidden,true,'unavailable season');
 route.set({season:'1'});assert.equal(toolbar.hidden,false,'available season restored');
 const restore=view.snapshot();view.prepare(null)();
 assert.equal(toolbar.hidden,true,'removing schedule hides controls');
 restore();assert.equal(toolbar.hidden,false,'rollback restores navigation');
});


test('FIXTURES-07: result groups show full time or supplied date above the score and the canonical home stadium below',()=>{
 const canonical=JSON.parse(read('data/clubs.json'));
 for(const d of divisions){
  const {view,fields,route}=setup(d),fixtures=schedule(d);
  fixtures.find(f=>f.round===1).kickoff='2026-10-20T12:30:00Z';
  fixtures.find(f=>f.round===16).kickoff='2026-10-20T12:30:00Z';
  view.prepare(fixtures)();
  const check=played=>{
   for(const row of fields.get('app-fixtures-list').children){
    const homeId=Number(row.dataset.fixtureMatch.split(':')[1]);
    const home=canonical.find(c=>c.countryId===d.countryId&&c.clubId===homeId);
    const result=row.children.find(n=>n.className==='app-fixture-result');
    assert.ok(result,'one result group per match');
    const [status,score,stadium]=result.children;
    assert.equal(score.className,'app-fixture-score');
    assert.equal(stadium.className,'app-fixture-stadium');
    assert.equal(stadium.textContent,home.stadiumName);
    if(played){assert.equal(contents(status),'Full time');assert.equal(status.tagName,'span');}
    else if(row===fields.get('app-fixtures-list').children[0]){
     assert.equal(status.tagName,'time');assert.equal(status.dateTime,'2026-10-20T12:30:00Z');
    }else assert.equal(contents(status),'Date TBD');
   }
  };
  check(true);route.set({matchday:16});check(false);
 }
});


test('FIXTURES-08: played scores have separate home, separator and away cells',()=>{
 const {view,fields}=setup(),fixtures=schedule(divisions[0]);
 for(const [homeGoals,awayGoals] of [[0,0],[1,11],[10,2]]){
  fixtures.filter(f=>f.round===1).forEach(f=>Object.assign(f,{homeGoals,awayGoals}));
  view.prepare(fixtures)();
  const score=fields.get('app-fixtures-list').children[0].children.find(n=>n.className==='app-fixture-result').children[1];
  assert.deepEqual(score.children.map(n=>n.className),['app-fixture-goals','app-fixture-separator','app-fixture-goals']);
  assert.equal(contents(score),homeGoals+' – '+awayGoals);
 }
});

const postseasonSchedule=(d,day)=>{
 const result=createPreviewPostseason(d,day),games=[];
 for(const tie of result.ties)for(const [leg,round] of [[0,31],[1,32]])games.push({
  round,homeId:tie.clubIds[leg===0?1:0],awayId:tie.clubIds[leg===0?0:1],kickoff:null,
  homeGoals:null,awayGoals:null,afterExtraTime:false,penalties:null,...tie.legs[leg]});
 if(result.final)games.push({round:33,kickoff:null,...result.final});
 return games;
};
test('FIXTURES-POSTSEASON: stages remain selectable with placeholders before qualification',()=>{
 for(const d of divisions){
  const {view,fields,route}=setup(d),key=d.tier===1?'playout':'playoffs';
  view.prepare(schedule(d,29),{postseason:postseasonSchedule(d,29)})();
  route.set({matchday:30});assert.equal(fields.get('app-fixtures-next').disabled,false);
  for(const day of [30,31,32,33]){
   const games=postseasonSchedule(d,day);
   view.prepare(schedule(d,30),{postseason:games})();route.set({matchday:30});
   assert.equal(fields.get('app-fixtures-next').disabled,false,'qualified post-season follows day 30');
   fields.get('app-fixtures-next').emit('click');assert.equal(route.get().matchday,key);
   assert.equal(fields.get('app-fixtures-round-label').hidden,true);
   assert.equal(fields.get('app-fixtures-next').disabled,true);
   const rows=fields.get('app-fixtures-list').children.filter(n=>n.className==='app-fixture-match');
   assert.equal(rows.length,d.tier===1?2:5);
   assert.deepEqual(rows.slice(0,games.length).map(row=>row.dataset.fixtureMatch),[...games].sort((a,b)=>a.round-b.round).map(g=>g.round+':'+g.homeId+':'+g.awayId));
   const walk=n=>[n,...n.children.flatMap(walk)];
   const scores=walk(fields.get('app-fixtures-list')).filter(n=>n.className==='app-fixture-goals');
   assert.equal(scores.length,games.filter(g=>g.homeGoals!==null).length*2);
   const restore=view.snapshot();view.prepare(schedule(d,29),{postseason:[]})();
   assert.equal(route.get().matchday,key,'rollback preserves the placeholder post-season route');
   restore();route.set({matchday:key});assert.equal(fields.get('app-fixtures-list').children.filter(n=>n.className==='app-fixture-match').length,rows.length);
   fields.get('app-fixtures-previous').emit('click');assert.equal(route.get().matchday,30);
  }
  view.prepare(null)();assert.equal(fields.get('app-fixtures-toolbar').hidden,true);
 }
});
test('FIXTURES-POSTSEASON: invalid extra fixtures fail before mutating the league or playoff view',()=>{
 const d=divisions.find(d=>d.tier===2),{view,fields,route}=setup(d),games=postseasonSchedule(d,33);
 view.prepare(schedule(d,30),{postseason:games})();route.set({matchday:'playoffs'});
 const before=fields.get('app-fixtures-list').children;
 const wrongFinal=games.map(g=>g.round===33?{...g,homeId:games[0].homeId,awayId:games[0].awayId,afterExtraTime:false,penalties:null}:g);
 const unplayedFirst=games.map(g=>g.round===31?{...g,homeGoals:null,awayGoals:null}:g);
 for(const invalid of [games.slice(1),games.map((g,i)=>i?g:{...g,homeId:999}),games.map((g,i)=>i?g:{...g,round:34}),games.map((g,i)=>i?g:{...g,awayGoals:null}),games.map((g,i)=>i?g:{...g,awayId:g.homeId}),wrongFinal,unplayedFirst]){
  assert.throws(()=>view.prepare(schedule(d,30),{postseason:invalid}));assert.equal(fields.get('app-fixtures-list').children,before);
 }
});

// Regression: Debug progress must not detach mounted crest hosts on incremental updates.
test("DEBUG-CREST-01 preserves mounted standings and Fixtures crest hosts",()=>{
 const dev=readFileSync(new URL("../tools/dev-standings-preview-client.mjs",import.meta.url),"utf8");
 const fixtures=readFileSync(new URL("../assets/competition-fixtures.js",import.meta.url),"utf8");
 assert.match(dev,/if\(restorePrevious\?\.refresh[\s\S]*?return restorePrevious;/);
 assert.match(fixtures,/const existing=new Map\(\[\.\.\.fields\.list\.children\]/);
 assert.match(fixtures,/return previous;/);
 assert.match(fixtures,/const next=matches\.map\(item=>\{/);
 assert.match(fixtures,/if\(typeof fields\.list\.insertBefore==="function"\)/);
});

test("STANDINGS-DEBUG-OUTCOME-01 clears stale winner and position bands",()=>{
 const page=read("assets/competition-page.js");
 assert.match(page,/if \(row\.dataset\.standingOutcome\) delete row\.dataset\.standingOutcome;/);
 assert.match(page,/row\.getAttribute\?\.\("aria-describedby"\)\?\.startsWith\("standings-outcome-"\)/);
 assert.match(page,/if \(outcome\) \{\s*row\.dataset\.standingOutcome = outcome;/);
});
