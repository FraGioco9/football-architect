import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const module={exports:{}};
runInNewContext(read('assets/standings-loading.js'),{module});
const {confirmedEmpty}=module.exports;
const context={selectedSeason:2,revision:6};
const panel={dataset:{faContentState:'empty',faContentSeason:'2',faContentRevision:'6'}};
test('skip skeleton only for known empty current season/revision',()=>{
 assert.equal(confirmedEmpty(panel,context,{season:'2'}),true);
 assert.equal(confirmedEmpty(panel,context,{season:'3'}),false);
 assert.equal(confirmedEmpty(panel,{...context,revision:7},{season:'2'}),false);
 assert.equal(confirmedEmpty(panel,{...context,selectedSeason:3},{season:'3'}),false);
 assert.equal(confirmedEmpty({...panel,dataset:{...panel.dataset,faContentState:'unknown'}},context,{season:'2'}),false);
 assert.equal(confirmedEmpty(null,context,{season:'2'}),false);
});
test('presenters require concrete absence instead of missing responses',()=>{
 assert.match(read('assets/competition-fixtures.js'),/data\.fixtures===null/);
 assert.match(read('assets/competition-fixtures.js'),/available&&\(\(international/);
 assert.match(read('assets/competition-stats.js'),/matchesPlayed===0/);
 assert.match(read('assets/competition-awards.js'),/confirmed&&recipients\.every/);
 assert.match(read('assets/app.css'),/data-fa-content-state="empty"/);
});


// PAGE-LOAD-03C2 — Award status may only follow a same-season, explicit
// snapshot. This pure extraction tests the same selector used by the real
// browser presenter, without a mock clock or fabricated winners.
function awardSelector(){
 const source=read('assets/competition-awards.js');
 const begin=source.indexOf('function selectAwardState(context,visible){');
 const end=source.indexOf('function render(context){',begin);
 assert.ok(begin>=0&&end>begin,'award snapshot selector is a dedicated function');
 assert.match(source,/const supplied=awardState\.recipients\[index\]/,
  'rendered award recipients must come from the selected-season snapshot only');
 assert.doesNotMatch(source,/const supplied=context\.seasonData\?\.awards/,
  'do not read old season recipients directly in card render');
 return runInNewContext(source.slice(begin,end)+';selectAwardState',{});
}
const awardState=awardSelector();
const categories=[{id:'champion'},{id:'player'}];
const a=(selectedSeason,season,awards,revision=1)=>({
 selectedSeason,revision,seasonData:season===null?null:{season,awards}
});
const get=(context)=>awardState(context,categories);

test('03C2 Awards: unknown source cannot masquerade as confirmed empty',()=>{
 assert.equal(get(a(1,null)).state,'unknown','bootstrap without source');
 assert.equal(get(a(1,1)).state,'unknown','same-season data without awards snapshot');
 assert.equal(get(a(1,1,{})).state,'unknown','missing awards entries are not empty arrays');
 assert.equal(get(a(1,1,{champion:{recipients:[]}})).state,'unknown',
  'partial awards snapshot is not full confirmation');
 assert.equal(get(a(1,1,{champion:{recipients:null},player:{recipients:[]}})).state,'unknown',
  'missing winner array is not a confirmed empty list');
 assert.equal(get(a(1,1,{champion:{recipients:[{name:''}]},player:{recipients:[]}})).state,'unknown',
  'invalid award recipient cannot certify content');
});
test('03C2 Awards: complete explicit pending and verified winners have distinct states',()=>{
 const pending=get(a(1,1,{champion:{recipients:[]},player:{recipients:[]}}));
 assert.equal(pending.state,'empty','two explicit empty arrays are confirmed pending');
 const winner=get(a(1,1,{champion:{recipients:[{name:'Verified player'}]},player:{recipients:[]}}));
 assert.equal(winner.state,'available','same-season valid winner is available');
 assert.equal(winner.recipients[0][0].name,'Verified player');
 const emptyPanel={dataset:{faContentState:pending.state,faContentSeason:'1',faContentRevision:'7'}};
 assert.equal(confirmedEmpty(emptyPanel,{selectedSeason:1,revision:7},{season:'1'}),true);
 assert.equal(confirmedEmpty(emptyPanel,{selectedSeason:1,revision:8},{season:'1'}),false,
  'a later source revision must return to the pending shell');
});
test('03C2 Awards: stale season cannot leak a prior winner or confirm emptiness',()=>{
 const awards={champion:{recipients:[{name:'OLD SEASON WINNER'}]},player:{recipients:[]}};
 const old=get(a(1,1,awards,3));
 assert.equal(old.state,'available');
 const moved=get(a(2,1,awards,4));
 assert.equal(moved.state,'unknown','selected Season 2 rejects Season 1 source');
 assert.ok(moved.recipients.every(x=>x===undefined),'no stale winners in rendered cards');
 const arrived=get(a(2,2,{champion:{recipients:[]},player:{recipients:[]}},5));
 assert.equal(arrived.state,'empty');
 const oldAgain=get(a(1,2,awards,6));
 assert.equal(oldAgain.state,'unknown','back-navigation also rejects newer season data');
});
test('03C2 Stats and History continue to reject mismatched selected seasons',()=>{
 assert.match(read('assets/competition-stats.js'),/data\.season!==context\.selectedSeason/);
 assert.match(read('assets/competition-stats.js'),/next\.revision<revision/);
 assert.match(read('assets/authoritative-history.mjs'),/data\.season!==context\.selectedSeason/);
 assert.match(read('assets/authoritative-history.mjs'),/history\?\.season!==context\.selectedSeason/);
});


test('03C2 real Awards presenter removes stale winners on season and source refresh',()=>{
 const node=(tag)=>({
  tagName:tag,children:[],dataset:{},className:'',textContent:'',
  classList:{add(){}},
  setAttribute(){},
  append(...children){this.children.push(...children)},
  insertBefore(item,before){const index=this.children.indexOf(before);this.children.splice(index<0?this.children.length:index,0,item)},
  replaceChildren(...children){this.children=children},
  querySelector(selector){return selector===':scope > .fa-awards'?this.children.find(x=>x.className==='fa-awards')??null:null}
 });
 const panel=node('section');
 const document={
  getElementById:id=>id==='competition-panel-awards'?panel:null,
  createElement:node,createElementNS:(_namespace,tag)=>node(tag)
 };
 const listeners={};
 const winnerData={season:1,awards:{champion:{recipients:[{name:'Season 1 champion'}]},player:{recipients:[]}}};
 const definition={id:'IT-1'};
 const initial={definition,selectedSeason:1,revision:1,seasonData:winnerData};
 const window={
  faCompetitionContext:initial,faAppRenderLanguage(){},
  faCompetitionRulesView:{awardIds:()=>['champion','player']},
  addEventListener:(type,handler)=>{listeners[type]=handler}
 };
 runInNewContext(read('assets/competition-awards.js'),{window,document});
 const chips=()=>{
  const result=[];
  const walk=entry=>{if(entry.className==='fa-awards-chip')result.push(entry.textContent);for(const item of entry.children)walk(item)};
  for(const entry of panel.children)walk(entry);
  return result;
 };
 assert.equal(panel.dataset.faContentState,'available');
 assert.equal(chips()[0],'Season 1 champion');
 const changed=next=>listeners['fa:competition-context-change']({detail:next});
 changed({...initial,selectedSeason:2,revision:2});
 assert.equal(panel.dataset.faContentState,'unknown');
 assert.equal(panel.dataset.faContentSeason,'2');
 assert.equal(panel.dataset.faContentRevision,'2');
 assert.deepEqual(chips(),['PENDING','PENDING'],'old winner removed, reserved award cards remain');
 changed({...initial,selectedSeason:2,revision:3,seasonData:{season:2,awards:{champion:{recipients:[]},player:{recipients:[]}}}});
 assert.equal(panel.dataset.faContentState,'empty','only explicit same-season empty lists confirm pending');
 assert.deepEqual(chips(),['PENDING','PENDING']);
 changed({...initial,selectedSeason:2,revision:4,seasonData:null});
 assert.equal(panel.dataset.faContentState,'unknown','refresh without a source resets certainty');
 assert.deepEqual(chips(),['PENDING','PENDING']);
});
