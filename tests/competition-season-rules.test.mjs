import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import model from '../assets/competition-model.js';
import rules from '../assets/competition-rules.js';
import view from '../assets/competition-rules-view.js';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import {createPreviewStandings,createPreviewHistory} from '../tools/dev-standings-preview-data.mjs';
const definitions=loadCompetitionCatalogue();
const definition=id=>definitions.find(d=>d.id===id);
const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url)));
const division=manifest.divisions.find(d=>d.id==='IT-1');
const copy=value=>JSON.parse(JSON.stringify(value));
const changed=()=>{const d=copy(definition('IT-1'));d.rules.phases[0].points.win=2;return rules.normalizeCompetition(d)};
function contextHarness(current){
 const source=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
 const start=source.indexOf('  const freeze=value=>'),end=source.indexOf('  async function start()',start);
 const window={dispatchEvent(){}};
 const api=runInNewContext(source.slice(start,end)+';definition=input;division=projection;activeDebugSeason=2;({selectSeason,replaceSeasonData,clearSeasonData,createContext})',{
  model,window,input:current,projection:division,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}}
 });
 window.faCompetitionContext=api.createContext(current,1,null,1);
 return {api,window};
}
test('SEASON-RULES: a validated stored snapshot wins over changed current configuration without mutation',()=>{
 assert.equal(typeof model.resolveSeasonRules,'function');
 const original=definition('IT-1'),record={season:1,rulesVersion:original.rules.version,rulesSnapshot:copy(original.rules),results:[{homeGoals:1,awayGoals:0}],statistics:{standings:[{pts:3}]}};
 const before=JSON.stringify(record),resolved=model.resolveSeasonRules(changed(),record);
 assert.equal(resolved.phases[0].points.win,3);assert.equal(changed().rules.phases[0].points.win,2);
 assert.equal(Object.isFrozen(resolved),true);assert.equal(Object.isFrozen(resolved.phases[0].points),true);
 assert.equal(Object.isFrozen(record.rulesSnapshot),false,'never freeze caller-owned stored objects');
 assert.equal(JSON.stringify(record),before);
 assert.equal(model.resolveSeasonRules(original,{season:1,rulesVersion:original.rules.version,rulesSnapshot:null}),null);
});
test('SEASON-RULES: legacy domestic records resolve an immutable baseline instead of current JSON',()=>{
 assert.equal(typeof model.resolveSeasonRules,'function');
 const legacy=copy(createPreviewStandings(division,30,1));delete legacy.rulesSnapshot;delete legacy.rulesVersion;
 const before=JSON.stringify(legacy);
 assert.equal(model.resolveSeasonRules(changed(),legacy).phases[0].points.win,3);
 assert.equal(model.resolveSeasonRules(changed(),{season:1,rulesVersion:'domestic-top-v1'}).phases[0].points.win,3);
 assert.equal(JSON.stringify(legacy),before);
 assert.equal(model.resolveSeasonRules(changed(),{season:1}),null,'no format evidence from the definition alone');
 assert.equal(model.resolveSeasonRules(changed(),{...legacy,divisionId:'ENG-1'}),null);
});
test('SEASON-RULES: unknown/malformed/mismatched versions and missing cup history fail closed',()=>{
 assert.equal(typeof model.resolveSeasonRules,'function');
 for(const d of definitions){
  assert.equal(model.resolveSeasonRules(d,null),null);
  assert.equal(model.resolveSeasonRules(d,{season:1,rulesVersion:'unknown-v99'}),null);
  const snapshot=copy(d.rules);snapshot.phases[0].points.win=-1;
  assert.equal(model.resolveSeasonRules(d,{season:1,rulesVersion:d.rules.version,rulesSnapshot:snapshot}),null);
  assert.equal(model.resolveSeasonRules(d,{season:1,rulesVersion:'wrong',rulesSnapshot:d.rules}),null);
  assert.equal(model.resolveSeasonRules(d,{season:0,rulesVersion:d.rules.version,rulesSnapshot:d.rules}),null);
 }
 for(const id of ['int-1','int-2']){
  const d=definition(id);assert.equal(model.resolveSeasonRules(d,{season:1}),null);
  assert.equal(model.resolveSeasonRules(d,{season:1,rulesVersion:d.rules.version,rulesSnapshot:copy(d.rules)}).version,d.rules.version);
 }
});
test('SEASON-CONTEXT: selected historical Rules and data retain their snapshot, then clear back to current rules',()=>{
 const current=changed(),r=contextHarness(current),historical=definition('IT-1');
 const data={season:1,rulesVersion:historical.rules.version,rulesSnapshot:copy(historical.rules),participants:division.clubs,fixtures:[],results:[{homeId:1,awayId:2,homeGoals:1,awayGoals:0}],statistics:{standings:[{club:division.clubs[0],pts:3}]},status:'partial'};
 const before=JSON.stringify(data);
 assert.equal(r.api.replaceSeasonData(data,1),true);
 const context=r.window.faCompetitionContext;
 assert.equal(context.definition.rules.phases[0].points.win,3);
 assert.ok(view.renderRules(context.definition).includes('data-rule-metric="points.win">3'));
 assert.equal(JSON.stringify(context.seasonData),before);assert.equal(JSON.stringify(data),before);
 const revision=context.revision;r.api.clearSeasonData();
 assert.equal(r.window.faCompetitionContext.definition.rules.phases[0].points.win,2);
 assert.equal(r.api.replaceSeasonData(data,revision),false,'old payload lease cannot replace a cleared season');
 const invalid={...data,rulesSnapshot:{schemaVersion:99}};
 assert.equal(r.api.replaceSeasonData(invalid,r.window.faCompetitionContext.revision),false);
});
test('SEASON-DEV: only new records receive snapshots and History reuses saved scores/tables unchanged',()=>{
 const newlyCreated=createPreviewStandings(division,30,1);
 assert.equal(newlyCreated.rulesVersion,'domestic-top-v1');
 assert.equal(newlyCreated.rulesSnapshot.phases[0].points.win,3);
 const saved=copy(newlyCreated);delete saved.rulesSnapshot;delete saved.rulesVersion;
 const before=JSON.stringify(saved),input={...division,rules:changed().rules};
 const history=createPreviewHistory(input,2,0,[saved]);
 assert.equal(JSON.stringify(history.completed[0]),before);
 assert.equal(JSON.stringify(saved),before);assert.equal(Object.hasOwn(saved,'rulesSnapshot'),false);
 assert.deepEqual(createPreviewHistory(input,1,0).completed,[],'no titles from definitions or unplayed seasons');
});
test('SEASON-HISTORY: the public canonical History consumer validates each season and uses generic cup identity',()=>{
 const source=readFileSync(new URL('../assets/competition-history.js',import.meta.url),'utf8');
 const start=source.indexOf('  const competitionId='),end=source.indexOf('  function element(',start);
 for(const id of ['IT-1','int-1','int-2']){
  const d=definition(id),window={faCompetitionContext:{definition:d},faCompetitionModel:model};
  const compute=runInNewContext(source.slice(start,end)+';compute',{window,document:{querySelector:()=>null,documentElement:{lang:'en'}}});
  const payload={source:'canonical',competitionId:id,coverage:'complete',provenance:{approved:true},seasons:[{seasonId:1,status:'completed',dataStatus:'approved',playerStatsComplete:true,rulesVersion:d.rules.version,rulesSnapshot:copy(d.rules),playerStats:[{playerId:'p1',playerName:'Player',countryId:'IT',clubId:1,goals:3,assists:1,appearances:2,cleanSheets:0}]}]};
  const before=JSON.stringify(payload);
  const result=compute(payload);assert.equal(result.totalGoals.value,3);assert.equal(JSON.stringify(payload),before);
  const invalid=copy(payload);invalid.seasons[0].rulesVersion='unknown';
  assert.throws(()=>compute(invalid),/rules/i);
  const missing=copy(payload);delete missing.seasons[0].rulesVersion;delete missing.seasons[0].rulesSnapshot;
  if(id==='IT-1')assert.equal(compute(missing).totalGoals.value,3,'known approved legacy domestic player contract');
  else assert.throws(()=>compute(missing),/rules/i,'cup history has no legacy domestic fallback');
  assert.ok(Object.values(compute({...payload,seasons:[]})).every(record=>record===null));
 }
});
test('SEASON-BANDS: historical standings use the selected snapshot instead of current rank bands',()=>{
 const source=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
 const start=source.indexOf('  function standingOutcome('),end=source.indexOf('  function decorateStanding',start);
 const current=copy(definition('IT-1'));current.rules.phases[0].rankOutcomes[0].to=2;current.rules.phases[0].rankOutcomes[1].from=3;
 const outcome=runInNewContext(source.slice(start,end)+';standingOutcome',{definition:current,window:{faCompetitionRules:rules,faCompetitionRulesView:view,faCompetitionContext:{definition:definition('IT-1')}}});
 assert.equal(outcome(1),'champion');assert.equal(outcome(2),'sovereign');assert.equal(outcome(3),'sovereign');assert.equal(outcome(4),'federation');assert.equal(outcome(6),'federation');assert.equal(outcome(7),'');
});
test('SEASON-BRACKET: runtime and static knockout markup can render a historical graph and phase identity',()=>{
 assert.equal(typeof view.renderPostseason,'function');
 const d=copy(definition('int-1')),phase=d.rules.phases.find(p=>p.id==='playoffs');
 phase.id='historic-playoffs';d.rules.phases[0].rankOutcomes.find(o=>o.targetPhaseId==='playoffs').targetPhaseId=phase.id;
 phase.ties[0].participants[0].rank=6;
 const html=view.renderPostseason(d);
 assert.ok(html.includes('data-postseason-config-tie="p512"'));
 assert.ok(html.includes('data-postseason-position="6"'));
 assert.ok(!html.includes('data-postseason-position="5"'));
});
test('SEASON-HISTORY-VERSIONS: mixed archives use the stable catalogue while any constituent season is selected',()=>{
 const source=readFileSync(new URL('../assets/competition-history.js',import.meta.url),'utf8');
 const start=source.indexOf('  const competitionId='),end=source.indexOf('  function element(',start);
 const current=copy(definition('IT-1'));current.rules.version='domestic-top-v2';current.rules.phases[0].points.win=2;
 const records=[definition('IT-1').rules,current.rules].map((snapshot,i)=>({seasonId:i+1,status:'completed',dataStatus:'approved',playerStatsComplete:true,rulesVersion:snapshot.version,rulesSnapshot:snapshot,playerStats:[{playerId:'p1',playerName:'Player',clubId:1,goals:3,assists:0,appearances:1,cleanSheets:0}]}));
 const payload={source:'canonical',competitionId:'IT-1',coverage:'complete',provenance:{approved:true},seasons:records};
 for(const selected of [definition('IT-1'),current]){
  const window={faCompetitionContext:{definition:selected,currentDefinition:current},faCompetitionModel:model};
  const compute=runInNewContext(source.slice(start,end)+';compute',{window,document:{querySelector:()=>null,documentElement:{lang:'en'}}});
  assert.equal(compute(payload).totalGoals.value,6);
 }
});
